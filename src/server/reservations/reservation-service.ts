/**
 * Reservation business logic: create reservation, cancel, list my entries, upgrade queue to reservation.
 * Uses entry repository, slot repo (booked_count + SELECT FOR UPDATE), config (surcharge),
 * Stripe PaymentIntent (Connect), and notification stubs.
 */
import { NotFoundError, ConflictError } from '@/lib/errors';
import { DEFAULT_COMMISSION_RATE } from '@/helpers/constants';
import { db } from '@/lib/db';
import { getConfigByStationId } from '@/server/station/config-repository';
import { findFormatByIdAndStation } from '@/server/station/format-repository';
import {
  lockSlotForUpdate,
  countReservationsBySlotId,
  incrementSlotBookedCount,
  decrementSlotBookedCount,
} from '@/server/station/slot-repository';
import { createPaymentIntent, cancelPaymentIntent } from '@/server/payments/payment-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import {
  createReservationEntry,
  findEntryByIdAndUser,
  findEntryByIdAndStation,
  hasActiveEntryAtStation,
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

  const commissionRate = DEFAULT_COMMISSION_RATE;
  const commissionAmount = amountTotal * parseFloat(commissionRate);
  const stationPayout = amountTotal - commissionAmount;

  // Atomic: check duplicate, lock slot (SELECT FOR UPDATE), verify capacity, insert entry, increment booked_count
  const entry = await db.transaction(async (tx) => {
    // Duplicate check inside transaction to prevent TOCTOU race
    const hasActive = await hasActiveEntryAtStation(userId, stationId, tx);
    if (hasActive) throw new ConflictError('You already have an active reservation at this station');

    const slot = await lockSlotForUpdate(timeSlotId, stationId, tx);
    if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');

    const count = await countReservationsBySlotId(timeSlotId, tx);
    if (count >= (slot.capacity ?? 0)) throw new ConflictError('Slot is full');

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
    // Rollback: cancel entry and decrement slot to avoid orphaned pending_payment
    await updateEntry(entry.id, { status: STATUS_CANCELLED, cancellation_reason: 'Payment setup failed' });
    await decrementSlotBookedCount(timeSlotId);
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
 * Cancels an entry (reservation or queue). For reservations, decrements slot booked_count.
 * For queue entries, shifts positions of entries behind it to fill the gap.
 */
export async function cancelEntry(entryId: string, userId: string): Promise<Entry> {
  const entry = await findEntryByIdAndUser(entryId, userId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.status === STATUS_CANCELLED) throw new ConflictError('Entry already cancelled');

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

  // Cancel Stripe PaymentIntent if entry was pending payment
  if (entry.status === STATUS_PENDING_PAYMENT && entry.stripe_payment_id) {
    try {
      await cancelPaymentIntent(entry.stripe_payment_id);
    } catch (e) {
      console.error('Failed to cancel Stripe PaymentIntent:', entry.stripe_payment_id, e);
    }
  }

  await notifyEntry({
    entryId,
    userId,
    stationId: entry.station_id,
    type: 'entry_cancelled',
  });
  return updated;
}

/**
 * Confirms the client's presence for a reservation.
 * Only allowed for reservations in 'confirmed' status owned by the user.
 * Sets client_confirmed = true. Idempotent if already confirmed.
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

/**
 * Upgrades a queue entry to a reservation by assigning a time slot. Charges reservation surcharge
 * if configured, then updates the entry and increments slot booked_count. Shifts queue positions.
 */
export async function upgradeQueueToReservation(
  entryId: string,
  userId: string,
  timeSlotId: string,
  stationId: string
): Promise<Entry> {
  const entry = await findEntryByIdAndUser(entryId, userId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.entry_type !== 'queue') throw new ConflictError('Entry is not a queue entry');
  if (entry.station_id !== stationId) throw new NotFoundError('Entry does not belong to this station');

  // Atomic: lock slot, verify capacity, shift queue, update entry, increment booked_count.
  const updated = await db.transaction(async (tx) => {
    const slot = await lockSlotForUpdate(timeSlotId, stationId, tx);
    if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');

    const count = await countReservationsBySlotId(timeSlotId, tx);
    if (count >= (slot.capacity ?? 0)) throw new ConflictError('Slot is full');

    const oldPosition = entry.queue_position ?? 0;
    await shiftQueuePositions(stationId, oldPosition + 1, -1, tx);
    const result = await updateEntry(
      entryId,
      {
        entry_type: 'reservation',
        time_slot_id: timeSlotId,
        queue_position: null,
        status: 'pending',
      },
      tx
    );
    await incrementSlotBookedCount(timeSlotId, tx);
    return result;
  });

  await notifyEntry({
    entryId,
    userId,
    stationId,
    type: 'reservation_created',
  });
  return updated;
}

/**
 * Updates an entry's status (station only). Used by PATCH /station/entries/:entryId.
 * On status completed, triggers invitation_to_rate notification.
 */
export async function setEntryStatusByStation(
  entryId: string,
  stationId: string,
  status: 'in_progress' | 'completed' | 'cancelled'
): Promise<Entry> {
  const entry = await findEntryByIdAndStation(entryId, stationId);
  if (!entry) throw new NotFoundError('Entry not found');
  const updated = await updateEntry(entryId, {
    status,
    completed_at: status === 'completed' ? new Date() : undefined,
    updated_at: new Date(),
  });
  if (status === 'completed') {
    await notifyEntry({
      entryId,
      userId: entry.user_id,
      stationId,
      type: 'invitation_to_rate',
    });
  }
  return updated;
}
