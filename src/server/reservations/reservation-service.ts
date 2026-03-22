/**
 * Reservation business logic: create reservation, cancel, list my entries, upgrade queue to reservation.
 * Uses entry repository, slot repo (booked_count + SELECT FOR UPDATE), config (surcharge),
 * Stripe PaymentIntent (Connect), and notification stubs.
 */
import { NotFoundError, ConflictError, ActiveReservationExistsError, SlotFullError } from '@/lib/errors';
import { MAX_ADVANCE_BOOKING_DAYS } from '@/helpers/constants';
import { getActiveCommissionRate } from '@/server/admin/platform-settings-service';
import { db } from '@/lib/db';
import { getConfigByStationId } from '@/server/station/config-repository';
import { findFormatByIdAndStation } from '@/server/station/format-repository';
import {
  lockSlotForUpdate,
  countReservationsBySlotId,
  incrementSlotBookedCount,
  decrementSlotBookedCount,
} from '@/server/station/slot-repository';
import { createPaymentIntent, cancelPaymentIntent, capturePaymentIntent } from '@/server/payments/payment-service';
import { cancelReservation } from '@/server/reservations/cancellation-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import { sendEscrowReleasedNotificationsForEntry } from '@/server/notifications/escrow-released-notifications';
import {
  createReservationEntry,
  findEntryByIdAndUser,
  findEntryByIdAndStation,
  hasActiveEntryAtStation,
  clearStripePaymentSucceededNotifiedAt,
  setStripePaymentSucceededNotifiedAtIfMissing,
  updateEntry,
  shiftQueuePositions,
  type Entry,
  type ListEntriesFilters,
  type PaginatedEntries,
  listEntriesByUserPaginated,
  listEntriesByStationPaginated,
} from './entry-repository';

const STATUS_PENDING_PAYMENT = 'pending_payment';
const STATUS_CANCELLED = 'cancelled';
const STATUS_CONFIRMED = 'confirmed';

function toDecimal(v: string | number): string {
  return typeof v === 'number' ? v.toFixed(2) : String(v);
}

function parseDecimal(s: string | null | undefined): number {
  if (s == null) return 0;
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : 0;
}

/** Result of createReservation: entry + Stripe client_secret for frontend payment. */
export type CreateReservationResult = {
  entry: Entry;
  clientSecret: string;
};

/**
 * Result of cancelEntry. Financial fields are only present for confirmed reservations
 * that triggered a Stripe refund (refundedAmount >= 0) or a late cancellation penalty.
 */
export type CancelEntryResult = {
  entry: Entry;
  refundedAmount?: number;
  penaltyAmount?: number;
  isLateCancellation?: boolean;
};

/**
 * Creates a reservation for the given slot and format.
 *
 * Flow:
 * 1. Validate format and station config
 * 2. Check no active entry exists for user at this station
 * 3. Atomic transaction: SELECT FOR UPDATE on slot, verify capacity, create entry, increment booked_count
 * 4. Create Stripe PaymentIntent (Connect) — after DB commit to avoid charging for failed inserts
 * 5. Update entry with Stripe payment ID
 * 6. Return entry + client_secret for frontend payment confirmation
 */
export async function createReservation(
  userId: string,
  stationId: string,
  stationStripeAccountId: string,
  timeSlotId: string,
  vehicleFormatId: string
): Promise<CreateReservationResult> {
  const format = await findFormatByIdAndStation(vehicleFormatId, stationId);
  if (!format) throw new NotFoundError('Vehicle format not found');

  const config = await getConfigByStationId(stationId);
  const surcharge = config?.reservation_surcharge
    ? parseDecimal(String(config.reservation_surcharge))
    : 0;
  const formatPrice = parseDecimal(String(format.price));
  const amountTotal = formatPrice + surcharge;
  if (amountTotal <= 0) throw new ConflictError('Invalid amount');

  const commissionRate = await getActiveCommissionRate();
  const commissionAmount = amountTotal * parseFloat(commissionRate);
  const stationPayout = amountTotal - commissionAmount;

  // Atomic: check duplicate, lock slot (SELECT FOR UPDATE), verify capacity, insert entry, increment booked_count
  const entry = await db.transaction(async (tx) => {
    // Duplicate check inside transaction to prevent TOCTOU race
    const hasActive = await hasActiveEntryAtStation(userId, stationId, tx);
    if (hasActive) throw new ActiveReservationExistsError();

    const slot = await lockSlotForUpdate(timeSlotId, stationId, tx);
    if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');

    // Stripe card authorizations expire after 7 days — reject bookings beyond this window.
    const maxAdvanceMs = MAX_ADVANCE_BOOKING_DAYS * 24 * 60 * 60 * 1000;
    if (slot.start_time.getTime() - Date.now() > maxAdvanceMs) {
      throw new ConflictError(`Reservations cannot be made more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance`);
    }

    const count = await countReservationsBySlotId(timeSlotId, tx);
    if (count >= (slot.capacity ?? 0)) throw new SlotFullError();

    const created = await createReservationEntry(
      {
        user_id: userId,
        station_id: stationId,
        vehicle_format_id: vehicleFormatId,
        time_slot_id: timeSlotId,
        status: STATUS_PENDING_PAYMENT,
        amount_paid: toDecimal(amountTotal),
        commission_rate: commissionRate,
        commission_amount: toDecimal(commissionAmount),
        station_payout: toDecimal(stationPayout),
        stripe_payment_id: null,
      },
      tx
    );
    await incrementSlotBookedCount(timeSlotId, tx);
    return created;
  });

  // Create Stripe PaymentIntent (outside transaction — Stripe is an external side-effect)
  // If Stripe fails, rollback the DB entry to avoid orphaned pending_payment entries
  const amountCents = Math.round(amountTotal * 100);
  const commissionCents = Math.round(commissionAmount * 100);

  let paymentIntentId: string;
  let clientSecret: string;
  try {
    const result = await createPaymentIntent({
      amountCents,
      userId,
      stationId,
      stationStripeAccountId,
      commissionCents,
      metadata: {
        reservation_id: entry.id,
        time_slot_id: timeSlotId,
        vehicle_format_id: vehicleFormatId,
      },
    });
    paymentIntentId = result.paymentIntentId;
    clientSecret = result.clientSecret;
  } catch (stripeError) {
    // Rollback: atomically cancel entry and decrement slot to avoid orphaned pending_payment
    await db.transaction(async (tx) => {
      await updateEntry(entry.id, { status: STATUS_CANCELLED, cancellation_reason: 'Payment setup failed' }, tx);
      await decrementSlotBookedCount(timeSlotId, tx);
    });
    throw stripeError;
  }

  // Persist stripe payment ID on the entry
  await updateEntry(entry.id, { stripe_payment_id: paymentIntentId });

  await notifyEntry({
    entryId: entry.id,
    userId,
    stationId,
    type: 'reservation_created',
  });

  return { entry: { ...entry, stripe_payment_id: paymentIntentId }, clientSecret };
}

/**
 * Unified entry cancellation for PATCH /me/entries/:entryId/cancel.
 * Handles all entry types and statuses:
 *
 * - Confirmed reservation (paid): delegates to cancelReservation() for full Stripe refund
 *   + penalty policy. Returns financial details in the result.
 * - Pending payment reservation: cancels the Stripe PaymentIntent, decrements slot.
 * - Queue entry: shifts positions, no Stripe interaction.
 */
export async function cancelEntry(
  entryId: string,
  userId: string,
  reason?: string
): Promise<CancelEntryResult> {
  const entry = await findEntryByIdAndUser(entryId, userId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.status === STATUS_CANCELLED) throw new ConflictError('Entry already cancelled');

  // Confirmed reservations: full cancellation with Stripe refund and penalty policy.
  if (entry.entry_type === 'reservation' && entry.status === STATUS_CONFIRMED) {
    const result = await cancelReservation(entryId, userId, reason);
    return {
      entry: result.entry,
      refundedAmount: result.refundedAmount,
      penaltyAmount: result.penaltyAmount,
      isLateCancellation: result.isLateCancellation,
    };
  }

  // Queue entries and pending_payment reservations: simple cancellation.
  const updated = await db.transaction(async (tx) => {
    const current = await findEntryByIdAndUser(entryId, userId, tx);
    if (!current) throw new NotFoundError('Entry not found');
    if (current.status === STATUS_CANCELLED) throw new ConflictError('Entry already cancelled');

    if (current.entry_type === 'reservation' && current.time_slot_id) {
      await decrementSlotBookedCount(current.time_slot_id, tx);
    }
    if (current.entry_type === 'queue' && current.queue_position != null) {
      await shiftQueuePositions(current.station_id, current.queue_position + 1, -1, tx);
    }
    return updateEntry(entryId, { status: STATUS_CANCELLED }, tx);
  });

  // Cancel Stripe PaymentIntent if the reservation was awaiting payment.
  if (entry.status === STATUS_PENDING_PAYMENT && entry.stripe_payment_id) {
    try {
      await cancelPaymentIntent(entry.stripe_payment_id);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('[CANCEL_PAYMENT_INTENT_FAILED]', {
        entryId,
        error,
      });
    }
  }

  await notifyEntry({
    entryId,
    userId,
    stationId: entry.station_id,
    type: 'entry_cancelled',
  });
  return { entry: updated };
}

/**
 * Confirms the client's presence for a reservation.
 * Only allowed for reservations in 'confirmed' status owned by the user.
 * Sets client_confirmed = true. Returns 409 if already confirmed.
 */
export async function confirmPresence(reservationId: string, userId: string): Promise<Entry> {
  const entry = await findEntryByIdAndUser(reservationId, userId);
  if (!entry) throw new NotFoundError('Reservation not found');
  if (entry.entry_type !== 'reservation') throw new ConflictError('Entry is not a reservation');
  if (entry.status !== 'confirmed') throw new ConflictError(`Cannot confirm presence for a reservation with status '${entry.status}'`);
  if (entry.client_confirmed) throw new ConflictError('Presence already confirmed');
  return updateEntry(reservationId, { client_confirmed: true });
}

/**
 * Returns paginated entries (reservations and queue) for the user.
 */
export async function listMyEntries(
  userId: string,
  filters?: ListEntriesFilters
): Promise<PaginatedEntries> {
  return listEntriesByUserPaginated(userId, filters);
}

/**
 * Returns paginated entries for the station.
 */
export async function listStationEntries(
  stationId: string,
  filters?: ListEntriesFilters
): Promise<PaginatedEntries> {
  return listEntriesByStationPaginated(stationId, filters);
}

/** Result of upgradeQueueToReservation: updated entry + Stripe client_secret for frontend payment. */
export type UpgradeToReservationResult = {
  entry: Entry;
  clientSecret: string;
};

/**
 * Upgrades a queue entry to a reservation by assigning a time slot and initiating payment.
 *
 * Flow:
 * 1. Validate entry is a queue entry belonging to the user at the given station.
 * 2. Resolve price: vehicle format price + optional reservation surcharge.
 * 3. Atomic transaction: lock slot, verify capacity, shift queue positions, convert entry to
 *    reservation (pending_payment), increment slot booked_count.
 * 4. Create Stripe PaymentIntent (manual capture) — outside the transaction.
 * 5. Persist stripe_payment_id on the entry.
 * 6. Return entry + client_secret for frontend payment confirmation.
 */
export async function upgradeQueueToReservation(
  entryId: string,
  userId: string,
  timeSlotId: string,
  stationId: string,
  stationStripeAccountId: string
): Promise<UpgradeToReservationResult> {
  const entry = await findEntryByIdAndUser(entryId, userId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.entry_type !== 'queue') throw new ConflictError('Entry is not a queue entry');
  if (entry.station_id !== stationId) throw new NotFoundError('Entry does not belong to this station');

  const format = await findFormatByIdAndStation(entry.vehicle_format_id, stationId);
  if (!format) throw new NotFoundError('Vehicle format not found');

  const config = await getConfigByStationId(stationId);
  const surcharge = config?.reservation_surcharge
    ? parseDecimal(String(config.reservation_surcharge))
    : 0;
  const formatPrice = parseDecimal(String(format.price));
  const amountTotal = formatPrice + surcharge;
  if (amountTotal <= 0) throw new ConflictError('Invalid amount');

  const commissionRate = await getActiveCommissionRate();
  const commissionAmount = amountTotal * parseFloat(commissionRate);
  const stationPayout = amountTotal - commissionAmount;

  // Atomic: lock slot, verify capacity, shift queue, convert entry, increment booked_count.
  const updated = await db.transaction(async (tx) => {
    const slot = await lockSlotForUpdate(timeSlotId, stationId, tx);
    if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');

    // Stripe card authorizations expire after 7 days.
    const maxAdvanceMs = MAX_ADVANCE_BOOKING_DAYS * 24 * 60 * 60 * 1000;
    if (slot.start_time.getTime() - Date.now() > maxAdvanceMs) {
      throw new ConflictError(`Reservations cannot be made more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance`);
    }

    const count = await countReservationsBySlotId(timeSlotId, tx);
    if (count >= (slot.capacity ?? 0)) throw new SlotFullError();

    const oldPosition = entry.queue_position ?? 0;
    await shiftQueuePositions(stationId, oldPosition + 1, -1, tx);
    const result = await updateEntry(
      entryId,
      {
        entry_type: 'reservation',
        time_slot_id: timeSlotId,
        queue_position: null,
        status: STATUS_PENDING_PAYMENT,
        amount_paid: toDecimal(amountTotal),
        commission_rate: commissionRate,
        commission_amount: toDecimal(commissionAmount),
        station_payout: toDecimal(stationPayout),
        stripe_payment_id: null,
      },
      tx
    );
    await incrementSlotBookedCount(timeSlotId, tx);
    return result;
  });

  // Create Stripe PaymentIntent outside transaction (external side-effect).
  const amountCents = Math.round(amountTotal * 100);
  const commissionCents = Math.round(commissionAmount * 100);

  let paymentIntentId: string;
  let clientSecret: string;
  try {
    const result = await createPaymentIntent({
      amountCents,
      userId,
      stationId,
      stationStripeAccountId,
      commissionCents,
      metadata: {
        reservation_id: entryId,
        time_slot_id: timeSlotId,
        vehicle_format_id: entry.vehicle_format_id,
        upgraded_from_queue: 'true',
      },
    });
    paymentIntentId = result.paymentIntentId;
    clientSecret = result.clientSecret;
  } catch (stripeError) {
    // Rollback: revert entry to queue and restore positions atomically to avoid partial state.
    await db.transaction(async (tx) => {
      await updateEntry(entryId, {
        entry_type: 'queue',
        time_slot_id: null,
        queue_position: entry.queue_position,
        status: 'pending',
        amount_paid: '0.00',
        commission_rate: '0.00',
        commission_amount: '0.00',
        station_payout: '0.00',
      }, tx);
      await decrementSlotBookedCount(timeSlotId, tx);
      // Restore queue positions: shift from oldPosition to make room for restored entry.
      if ((entry.queue_position ?? 0) > 0) {
        await shiftQueuePositions(stationId, entry.queue_position!, 1, tx);
      }
    });
    throw stripeError;
  }

  await updateEntry(entryId, { stripe_payment_id: paymentIntentId });

  await notifyEntry({
    entryId,
    userId,
    stationId,
    type: 'reservation_created',
  });

  return { entry: { ...updated, stripe_payment_id: paymentIntentId }, clientSecret };
}


const VALID_STATION_TRANSITIONS: Record<string, readonly string[]> = {
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
};

/**
 * Updates an entry's status (station only). Used by PATCH /station/entries/:entryId.
 * Enforces valid status transitions:
 *   confirmed   → in_progress | cancelled
 *   in_progress → completed   | cancelled
 * Any other transition is rejected with a ConflictError.
 *
 * On status completed:
 *   - Captures the Stripe PaymentIntent (reservation entries only) to distribute funds.
 *   - Invitation_to_rate push is triggered later by Stripe webhook (payment_intent.succeeded)
 *     to align notifications with escrow release and ensure idempotence.
 *   - No per-transaction escrow email is sent here; admin email reporting is weekly (cron).
 * If the Stripe capture fails, the entry is still marked completed and the error is logged
 * for manual resolution (the service was rendered).
 */
export async function setEntryStatusByStation(
  entryId: string,
  stationId: string,
  status: 'in_progress' | 'completed' | 'cancelled'
): Promise<Entry> {
  const entry = await findEntryByIdAndStation(entryId, stationId);
  if (!entry) throw new NotFoundError('Entry not found');

  const allowed = VALID_STATION_TRANSITIONS[entry.status];
  if (!allowed || !allowed.includes(status)) {
    throw new ConflictError(
      `Cannot transition entry from '${entry.status}' to '${status}'`
    );
  }

  const updated = await updateEntry(entryId, {
    status,
    completed_at: status === 'completed' ? new Date() : undefined,
    updated_at: new Date(),
  });
  if (status === 'completed') {
    // Capture the payment for reservation entries (distributes funds to station + platform).
    // Queue (walk-in) entries have no stripe_payment_id and are skipped.
    if (entry.entry_type === 'reservation' && entry.stripe_payment_id) {
      try {
        await capturePaymentIntent(entry.stripe_payment_id);
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[CAPTURE_FAILED] Service completed but Stripe capture failed — manual resolution required', {
          entryId,
          error,
        });
      }
    }

    // %%%%% ESCROW FALLBACK — webhook before "completed" %%%%%
    // Late capture: `updated` reflects RETURNING row (not stale `entry`) for succeeded_at / notify flag.
    if (updated.entry_type === 'reservation' && updated.stripe_payment_succeeded_at) {
      try {
        const claimed = await setStripePaymentSucceededNotifiedAtIfMissing(
          updated.id,
          updated.stripe_payment_succeeded_at
        );

        if (claimed) {
          try {
            await sendEscrowReleasedNotificationsForEntry(
              updated,
              updated.stripe_payment_succeeded_at
            );
          } catch (err) {
            await clearStripePaymentSucceededNotifiedAt(updated.id);
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[ESCROW_FALLBACK] Escrow released notifications failed', { error: msg });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[ESCROW_FALLBACK] Failed to send completed escrow notifications', { error: msg });
      }

      // %%%%% END - ESCROW FALLBACK — webhook before "completed" %%%%%
    }
  }
  return updated;
}
