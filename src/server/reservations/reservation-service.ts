/**
 * Reservation business logic: create reservation, cancel, list my entries, upgrade queue to reservation.
 *
 * Core operations:
 *   - createReservation: new booking with Stripe PaymentIntent and atomic slot check
 *   - cancelReservation: cancel with optional refund or late-cancellation penalty handling
 *   - listMyReservations / listStationReservations: paginated entry listings
 *   - onStripePaymentSucceeded: mark entry as confirmed when payment captured
 *
 * Dependencies:
 *   - Entry repository (CRUD operations on reservation entries)
 *   - Slot repository (booked_count tracking, SELECT FOR UPDATE locking)
 *   - Station config (surcharge read)
 *   - Stripe PaymentIntent (Connect charges)
 *   - Notifications (fire-and-forget entry updates)
 */
import { NotFoundError, ConflictError, ActiveReservationExistsError, SlotFullError, ValidationError } from '@/lib/errors';
import { getPlatformSettingWithFallback, getCancellationPolicy } from '@/server/admin/platform-settings-service';
import { db } from '@/lib/db';
import { getConfigByStationId } from '@/server/station/config-repository';
import { findServiceVehicleEntryForBooking, findServiceByIdAndStation } from '@/server/station/service-repository';
import { findFormatById } from '@/server/station/format-repository';
import {
  lockSlotForUpdate,
  countReservationsBySlotId,
  incrementSlotBookedCount,
  decrementSlotBookedCount,
} from '@/server/station/slot-repository';
import { createPaymentIntent, cancelPaymentIntent, capturePaymentIntent, refundPaymentIntent, distributePenalty, updatePaymentIntentMetadata } from '@/server/payments/payment-service';
import { cancelReservation } from '@/server/reservations/cancellation-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import { sendEscrowReleasedNotificationsForEntry } from '@/server/notifications/escrow-released-notifications';
import {
  createReservationEntry,
  createQueueEntry,
  findEntryByIdAndUser,
  findEntryByIdAndStation,
  hasActiveReservationForSlot,
  clearStripePaymentSucceededNotifiedAt,
  setStripePaymentSucceededNotifiedAtIfMissing,
  updateEntry,
  shiftQueuePositions,
  repositionQueueEntry,
  getNextQueuePosition,
  listRichEntriesByUser,
  findRichEntryByIdAndUser,
  listRichStationEntriesPaginated,
  type Entry,
  type ListEntriesFilters,
  type PaginatedEntries,
  type RichEntry,
  type RichStationEntry,
  listEntriesByUserPaginated,
  listEntriesByStationPaginated,
} from './entry-repository';
import { computeReservationSplit } from './compute-reservation-split';
import { verifyQrToken } from '@/server/qr/qr-token-service';
import { refreshStationStats } from '@/server/station/station-stats-service';


// %%%%% Constants %%%%%
// Entry status values

const STATUS_PENDING_PAYMENT = 'pending_payment';
const STATUS_CANCELLED = 'cancelled';
const STATUS_CONFIRMED = 'confirmed';


// %%%%% Utilities %%%%%
// Number formatting and parsing

function toDecimal(v: string | number): string {
  return typeof v === 'number' ? v.toFixed(2) : String(v);
}

function parseDecimal(s: string | null | undefined): number {
  if (s == null) return 0;
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Reads the max advance booking days setting and returns the cutoff in milliseconds.
 * Stripe card authorizations expire after 7 days, so bookings beyond this window must be rejected.
 */
async function getMaxAdvanceBookingMs(): Promise<{ maxDays: number; maxAdvanceMs: number }> {
  const raw = parseInt(
    await getPlatformSettingWithFallback('max_advance_booking_days', 'PLATFORM_MAX_ADVANCE_BOOKING_DAYS', '7'),
    10
  );
  const maxDays = Number.isFinite(raw) && raw >= 1 ? raw : 7;
  return { maxDays, maxAdvanceMs: maxDays * 24 * 60 * 60 * 1000 };
}

/**
 * Resolves the total amount for a reservation using the service vehicle entry price + optional station surcharge.
 */
async function resolveReservationAmount(
  serviceId: string,
  vehicleFormatId: string | null | undefined,
  stationId: string
): Promise<{ vehicleEntry: Awaited<ReturnType<typeof findServiceVehicleEntryForBooking>>; amountTotal: number }> {
  const vehicleEntry = await findServiceVehicleEntryForBooking(serviceId, vehicleFormatId ?? null);
  if (!vehicleEntry) throw new NotFoundError('Service pricing entry not found for this format');

  const config = await getConfigByStationId(stationId);
  const surcharge = config?.reservation_surcharge
    ? parseDecimal(String(config.reservation_surcharge))
    : 0;
  const amountTotal = parseDecimal(String(vehicleEntry.price)) + surcharge;
  if (amountTotal <= 0) throw new ConflictError('Invalid amount');

  return { vehicleEntry, amountTotal };
}


// %%%%% Types %%%%%
// Operation results

/**
 * Result of createReservation operation.
 * Includes the created entry and Stripe client_secret for frontend payment UI.
 */
export type CreateReservationResult = {
  entry: Entry;
  clientSecret: string;
};

/**
 * Result of cancelEntry operation.
 * Financial fields (refundedAmount, penaltyAmount) are only present for confirmed reservations
 * that triggered a Stripe refund or a late-cancellation penalty calculation.
 */
export type CancelEntryResult = {
  entry: Entry;
  refundedAmount?: number;
  penaltyAmount?: number;
  isLateCancellation?: boolean;
};


// %%%%% Create reservation %%%%%
// Atomic slot lock, capacity check, entry creation, Stripe intent

/**
 * Creates a new reservation for the given time slot and vehicle format.
 *
 * Stripe-first pattern: PI is created before the DB transaction so there is no crash window
 * where an entry exists with stripe_payment_id = null. If the DB transaction fails (slot full,
 * duplicate, etc.), the PI is never returned to the client and auto-expires on Stripe after 24h -
 * no charge, no orphan, no rollback needed.
 *
 * Full flow:
 * 1. Validate vehicle format and station config (surcharge)
 * 2. QR token validation
 * 3. Create Stripe PaymentIntent (before DB - Stripe-first)
 * 4. Atomic transaction:
 *    - Duplicate check (SELECT FOR UPDATE on slot prevents TOCTOU)
 *    - Lock slot, verify capacity, enforce max advance booking window
 *    - Insert entry with stripe_payment_id already set, increment slot booked_count
 * 5. Update PI metadata with reservation_id (non-fatal - informational only)
 * 6. Send notification to client
 *
 * @param userId - Client UUID
 * @param stationId - Station UUID
 * @param stationStripeAccountId - Stripe Connect account for destination charge
 * @param timeSlotId - Time slot UUID
 * @param vehicleFormatId - Vehicle format UUID
 * @param options - Optional QR booking context (token + version for kiosk bookings)
 * @returns CreateReservationResult with entry and Stripe client_secret
 * @throws NotFoundError - format or slot not found
 * @throws ConflictError - invalid amount, active reservation exists, or booking window exceeded
 * @throws SlotFullError - slot at capacity
 * @throws ValidationError - invalid QR booking token
 */
export async function createReservation(
  userId: string,
  stationId: string,
  stationStripeAccountId: string,
  timeSlotId: string,
  serviceId: string,
  vehicleFormatId: string | null | undefined,
  options?: { qrToken?: string; qrVersion?: string }
): Promise<CreateReservationResult> {
  const service = await findServiceByIdAndStation(serviceId, stationId);
  if (!service) throw new NotFoundError('Service not found');

  const { amountTotal, vehicleEntry } = await resolveReservationAmount(serviceId, vehicleFormatId, stationId);

  const hasQrPayload = Boolean(options?.qrToken || options?.qrVersion);
  const qrValidation = options?.qrToken
    ? verifyQrToken({
        stationId,
        qrToken: options.qrToken,
        version: options.qrVersion,
      })
    : { isValid: false as const, reason: undefined };
  const isQrBooking = Boolean(options?.qrToken) && qrValidation.isValid;
  if (hasQrPayload && !isQrBooking) {
    throw new ValidationError('Invalid QR booking token context');
  }

  const split = await computeReservationSplit({ amountTotal, isQrBooking });

  const amountCents = Math.round(amountTotal * 100);
  const commissionCents = Math.round(split.commissionAmount * 100);

  // Create Stripe PaymentIntent before the DB transaction (Stripe-first pattern).
  // reservation_id is set via a non-fatal metadata update after DB commit.
  const { paymentIntentId, clientSecret } = await createPaymentIntent({
    amountCents,
    userId,
    stationId,
    stationStripeAccountId,
    commissionCents,
    metadata: {
      time_slot_id: timeSlotId,
      service_id: serviceId,
      vehicle_format_id: vehicleFormatId ?? '',
    },
  });

  // Atomic: duplicate check, slot lock (SELECT FOR UPDATE), capacity check, entry insert, slot increment.
  // Entry is created with stripe_payment_id already set - no orphan window.
  const entry = await db.transaction(async (tx) => {
    const hasActive = await hasActiveReservationForSlot(userId, timeSlotId, tx);
    if (hasActive) throw new ActiveReservationExistsError();

    const slot = await lockSlotForUpdate(timeSlotId, stationId, tx);
    if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');

    // Stripe card authorizations expire after 7 days - reject bookings beyond this window.
    const { maxDays, maxAdvanceMs } = await getMaxAdvanceBookingMs();
    if (slot.start_time.getTime() - Date.now() > maxAdvanceMs) {
      throw new ConflictError(`Reservations cannot be made more than ${maxDays} days in advance`);
    }

    const count = await countReservationsBySlotId(timeSlotId, tx);
    if (count >= (slot.capacity ?? 0)) throw new SlotFullError();

    const created = await createReservationEntry(
      {
        user_id: userId,
        station_id: stationId,
        vehicle_format_id: vehicleFormatId ?? null,
        time_slot_id: timeSlotId,
        status: STATUS_PENDING_PAYMENT,
        amount_paid: toDecimal(amountTotal),
        booking_source: split.bookingSource,
        commission_rate: split.commissionRate,
        commission_amount: toDecimal(split.commissionAmount),
        station_payout: toDecimal(split.stationPayout),
        stripe_payment_id: paymentIntentId,
      },
      tx
    );
    await incrementSlotBookedCount(timeSlotId, tx);
    return created;
  });

  // Update PI metadata with reservation_id now that the entry ID is known.
  // Non-fatal: metadata is informational only; webhook resolution uses stripe_payment_id on the entry.
  try {
    await updatePaymentIntentMetadata(paymentIntentId, { reservation_id: entry.id });
  } catch (e) {
    console.error('[CREATE_RESERVATION] PI metadata update failed - non-fatal', {
      entryId: entry.id,
      paymentIntentId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  await notifyEntry({
    entryId: entry.id,
    userId,
    stationId,
    type: 'reservation_created',
  });

  return { entry, clientSecret };
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

  // Queue entry with authorized (not yet captured) payment: apply cancellation fees.
  // pending_payment = Stripe has not confirmed yet → just cancel the PI (no charge).
  // in_progress = already being served → cannot self-cancel via this path.
  if (
    entry.entry_type === 'queue' &&
    entry.stripe_payment_id &&
    entry.status !== STATUS_PENDING_PAYMENT &&
    entry.status !== 'in_progress'
  ) {
    const policy = await getCancellationPolicy();

    // Compute penalty and refund amounts inside the transaction so they are
    // derived from the transactionally-consistent amount_paid, not the stale
    // pre-read value. Declared with let so the Stripe block below can read them.
    let penaltyAmount = 0;
    let refundedAmount = 0;

    const updated = await db.transaction(async (tx) => {
      const current = await findEntryByIdAndUser(entryId, userId, tx);
      if (!current) throw new NotFoundError('Entry not found');
      if (current.status === STATUS_CANCELLED) throw new ConflictError('Entry already cancelled');

      // Defensive: amount_paid comes from the DB as a string. Clamp to a non-negative
      // finite number so a corrupt / migrated row cannot produce negative Stripe cents.
      const rawAmount = parseFloat(String(current.amount_paid));
      const amountPaid = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;
      penaltyAmount = Math.max(
        0,
        Math.round(amountPaid * policy.penaltyRate * 100) / 100
      );
      refundedAmount = Math.max(
        0,
        Math.round((amountPaid - penaltyAmount) * 100) / 100
      );

      if (current.entry_type === 'queue' && current.queue_position != null) {
        await shiftQueuePositions(current.station_id, current.queue_position + 1, -1, tx);
      }
      return updateEntry(
        entryId,
        {
          status: STATUS_CANCELLED,
          cancellation_reason: reason ?? null,
          penalty_amount: penaltyAmount > 0 ? penaltyAmount.toFixed(2) : null,
        },
        tx
      );
    });

    // Stripe: capture full amount → partial refund → distribute penalty share.
    // Kept outside the transaction: Stripe calls must not hold DB locks.
    let captured = false;
    let chargeId: string | null = null;
    let transferId: string | null = null;
    try {
      ({ chargeId, transferId } = await capturePaymentIntent(entry.stripe_payment_id));
      captured = true;
    } catch (e) {
      console.error('[QUEUE_CANCEL_CAPTURE_FAILED]', {
        entryId,
        stripe_payment_id: entry.stripe_payment_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    if (captured && chargeId) {
      try {
        await updateEntry(entryId, { stripe_charge_id: chargeId });
      } catch (e) {
        console.error('[QUEUE_CANCEL_STRIPE_CHARGE_ID_UPDATE_FAILED]', {
          entryId,
          chargeId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (captured && refundedAmount > 0) {
      try {
        const refundId = await refundPaymentIntent(
          entry.stripe_payment_id,
          Math.round(refundedAmount * 100),
          `queue-cancel-refund:${entryId}`
        );
        await updateEntry(entryId, { stripe_refund_id: refundId });
      } catch (e) {
        console.error('[QUEUE_CANCEL_REFUND_FAILED]', {
          entryId,
          stripe_payment_id: entry.stripe_payment_id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (captured && penaltyAmount > 0) {
      try {
        await distributePenalty(
          entry.stripe_payment_id,
          Math.round(penaltyAmount * 100),
          policy.stationPenaltyShare,
          `queue-cancel-penalty:${entryId}`,
          chargeId ?? undefined,
          transferId ?? undefined,
        );
      } catch (e) {
        console.error('[QUEUE_CANCEL_PENALTY_DIST_FAILED]', {
          entryId,
          stripe_payment_id: entry.stripe_payment_id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    await notifyEntry({
      entryId,
      userId,
      stationId: entry.station_id,
      type: 'queue_cancelled_by_client',
      payload: { penaltyAmount, refundedAmount },
    });
    return { entry: updated, penaltyAmount, refundedAmount, isLateCancellation: true };
  }

  // Queue entry with no payment or pending_payment reservation: simple cancellation.
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

  // Cancel the PaymentIntent if payment hasn't been confirmed yet (no charge).
  if (entry.stripe_payment_id && entry.status === STATUS_PENDING_PAYMENT) {
    try {
      await cancelPaymentIntent(entry.stripe_payment_id);
    } catch (e) {
      console.error('[CANCEL_PAYMENT_INTENT_FAILED]', {
        entryId,
        error: e instanceof Error ? e.message : String(e),
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
 * Returns paginated rich entries for the user, including denormalized station,
 * vehicle format, is_rated, is_tipped, and estimated_wait_minutes.
 */
export async function listMyRichEntries(
  userId: string,
  filters?: ListEntriesFilters
): Promise<{ rows: RichEntry[]; total: number; page: number; per_page: number }> {
  return listRichEntriesByUser(userId, filters);
}

/**
 * Returns a single rich entry by id with ownership check. Returns undefined when not found.
 */
export async function getMyRichEntry(
  entryId: string,
  userId: string
): Promise<RichEntry | undefined> {
  return findRichEntryByIdAndUser(entryId, userId);
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

/**
 * Returns paginated station entries enriched with user first_name and vehicle format.
 */
export async function listRichStationEntries(
  stationId: string,
  filters?: ListEntriesFilters
): Promise<{ rows: RichStationEntry[]; total: number; page: number; per_page: number }> {
  return listRichStationEntriesPaginated(stationId, filters);
}

/** Result of upgradeQueueToReservation: updated entry + Stripe client_secret for frontend payment. */
export type UpgradeToReservationResult = {
  entry: Entry;
  clientSecret: string;
};

/**
 * Upgrades a queue entry to a reservation by assigning a time slot and initiating payment.
 *
 * Stripe-first pattern: PI is created before the DB transaction so there is no crash window
 * where an entry exists with stripe_payment_id = null. If the DB transaction fails (slot full,
 * advance booking limit, etc.), the PI is never returned to the client and auto-expires on
 * Stripe after 24h - no charge, no orphan, no rollback needed.
 *
 * Flow:
 * 1. Validate entry is a queue entry belonging to the user at the given station.
 * 2. Resolve price: vehicle format price + optional reservation surcharge.
 * 3. Create Stripe PaymentIntent (before DB - Stripe-first).
 * 4. Atomic transaction: lock slot, verify capacity, shift queue positions, convert entry to
 *    reservation (pending_payment) with stripe_payment_id already set, increment slot booked_count.
 * 5. Update PI metadata with reservation_id (non-fatal - informational only).
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

  // Price = original queue amount + optional reservation surcharge.
  // service_id is not stored on the entry; use amount_paid as the already-validated base price.
  const config = await getConfigByStationId(stationId);
  const surcharge = config?.reservation_surcharge ? parseDecimal(String(config.reservation_surcharge)) : 0;
  const amountTotal = parseDecimal(String(entry.amount_paid)) + surcharge;

  const split = await computeReservationSplit({ amountTotal, isQrBooking: false });

  const amountCents = Math.round(amountTotal * 100);
  const commissionCents = Math.round(split.commissionAmount * 100);

  // Create Stripe PaymentIntent before the DB transaction (Stripe-first pattern).
  // reservation_id is set via a non-fatal metadata update after DB commit.
  const { paymentIntentId, clientSecret } = await createPaymentIntent({
    amountCents,
    userId,
    stationId,
    stationStripeAccountId,
    commissionCents,
    metadata: {
      time_slot_id: timeSlotId,
      vehicle_format_id: entry.vehicle_format_id ?? '',
      upgraded_from_queue: 'true',
    },
  });

  // Atomic: slot lock, capacity check, queue shift, entry conversion with stripe_payment_id already set.
  const updated = await db.transaction(async (tx) => {
    const slot = await lockSlotForUpdate(timeSlotId, stationId, tx);
    if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');

    // Stripe card authorizations expire after 7 days.
    const { maxDays: maxDaysUpgrade, maxAdvanceMs } = await getMaxAdvanceBookingMs();
    if (slot.start_time.getTime() - Date.now() > maxAdvanceMs) {
      throw new ConflictError(`Reservations cannot be made more than ${maxDaysUpgrade} days in advance`);
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
        booking_source: 'standard',
        commission_rate: split.commissionRate,
        commission_amount: toDecimal(split.commissionAmount),
        station_payout: toDecimal(split.stationPayout),
        stripe_payment_id: paymentIntentId,
      },
      tx
    );
    await incrementSlotBookedCount(timeSlotId, tx);
    return result;
  });

  // Update PI metadata with reservation_id now that the entry ID is confirmed.
  // Non-fatal: metadata is informational only; webhook resolution uses stripe_payment_id on the entry.
  try {
    await updatePaymentIntentMetadata(paymentIntentId, { reservation_id: entryId });
  } catch (e) {
    console.error('[UPGRADE_TO_RESERVATION] PI metadata update failed - non-fatal', {
      entryId,
      paymentIntentId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  await notifyEntry({
    entryId,
    userId,
    stationId,
    type: 'reservation_created',
  });

  return { entry: updated, clientSecret };
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
    ...(status === 'completed' ? { completed_at: new Date() } : {}),
  });
  if (status === 'completed') {
    // Capture the payment (distributes funds to station + platform).
    if (entry.stripe_payment_id) {
      try {
        const { chargeId } = await capturePaymentIntent(entry.stripe_payment_id);
        if (chargeId) {
          await updateEntry(entryId, { stripe_charge_id: chargeId });
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[CAPTURE_FAILED] Service completed but Stripe capture failed - manual resolution required', {
          entryId,
          error,
        });
      }
    }

    // %%%%% ESCROW FALLBACK - webhook before "completed" %%%%%
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

      // %%%%% END - ESCROW FALLBACK - webhook before "completed" %%%%%
    }

    // Refresh station_stats so completed_count stays current for the "most visited" sort group.
    // Fire-and-forget: must not block the station's UI response.
    refreshStationStats().catch((err) => {
      console.error('[STATION_STATS_REFRESH] Failed after reservation completion', {
        entryId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
  return updated;
}


// %%%%% Walk-in entry creation %%%%%
// Station creates an entry for a walk-in client (no Stripe payment flow)

/**
 * Creates a walk-in entry for the station.
 * If time_slot_id is provided, entry_type is 'reservation'; otherwise 'queue'.
 * The format must belong to the station. Status is 'confirmed' (payment collected on-site).
 *
 * Walk-ins have no registered customer account, but `reservations.user_id` is a non-null
 * FK to `users.id`. We therefore record the station owner's user_id as the placeholder,
 * which is a real users row and is already authorized for the station. This keeps the FK
 * valid and prevents the row from being incorrectly attributed to an unrelated user.
 * Filtering walk-ins out of "my entries" listings is done via station.user_id ownership
 * checks where applicable.
 */
export async function createWalkInEntry(
  stationId: string,
  stationOwnerUserId: string,
  vehicleFormatId: string,
  timeSlotId?: string
): Promise<Entry> {
  const format = await findFormatById(vehicleFormatId);
  if (!format) throw new NotFoundError('Vehicle format not found');

  if (timeSlotId) {
    return createReservationEntry({
      user_id: stationOwnerUserId, // walk-in placeholder: station owner's user_id (real users row)
      station_id: stationId,
      vehicle_format_id: vehicleFormatId,
      time_slot_id: timeSlotId,
      booking_source: 'standard',
      status: STATUS_CONFIRMED,
      amount_paid: toDecimal(String(format.price)),
      commission_rate: '0',
      commission_amount: '0',
      station_payout: toDecimal(String(format.price)),
    });
  }

  const queuePosition = await getNextQueuePosition(stationId);
  return createQueueEntry({
    user_id: stationOwnerUserId,
    station_id: stationId,
    vehicle_format_id: vehicleFormatId,
    queue_position: queuePosition,
    status: STATUS_CONFIRMED,
    amount_paid: toDecimal(String(format.price)),
    commission_rate: '0',
    commission_amount: '0',
    station_payout: toDecimal(String(format.price)),
  });
}


// %%%%% Queue priority management %%%%%
// Station sets queue_position for an entry

/** Terminal statuses that block priority changes. */
const TERMINAL_STATUSES = ['cancelled', 'completed', 'in_progress'];

/**
 * Repositions a queue entry to a new position (1-based). 'front' maps to position 1.
 * Shifts neighboring entries to preserve a contiguous, gap-free queue.
 * Throws ConflictError if the entry is not an active queue entry.
 */
export async function setPriorityForEntry(
  entryId: string,
  stationId: string,
  position: 'front' | number
): Promise<Entry> {
  const entry = await findEntryByIdAndStation(entryId, stationId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.entry_type !== 'queue') throw new ConflictError('Entry is not a queue entry');
  if (TERMINAL_STATUSES.includes(entry.status)) {
    throw new ConflictError(`Cannot reprioritize an entry with status '${entry.status}'`);
  }
  if (entry.queue_position == null) throw new ConflictError('Entry has no queue position');

  const newPos = position === 'front' ? 1 : Math.max(1, Math.floor(position));
  await repositionQueueEntry(entryId, stationId, entry.queue_position, newPos);

  const updated = await findEntryByIdAndStation(entryId, stationId);
  if (!updated) throw new NotFoundError('Entry not found after update');
  return updated;
}
