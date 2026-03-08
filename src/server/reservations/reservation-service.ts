/**
 * Reservation business logic: create reservation, cancel, list my entries, upgrade queue to reservation.
 * Uses entry repository, slot repo (booked_count), config (surcharge), payment and notification stubs.
 */
import { NotFoundError, ConflictError } from '@/lib/errors';
import { getConfigByStationId } from '@/server/station/config-repository';
import { findFormatByIdAndStation } from '@/server/station/format-repository';
import {
  findSlotByIdAndStation,
  countReservationsBySlotId,
  incrementSlotBookedCount,
  decrementSlotBookedCount,
} from '@/server/station/slot-repository';
import { processPayment } from '@/server/payments/payment-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import {
  createReservationEntry,
  findEntryByIdAndUser,
  findEntryByIdAndStation,
  listEntriesByUser,
  updateEntry,
  shiftQueuePositions,
  type Entry,
} from './entry-repository';

const DEFAULT_COMMISSION_RATE = '0.1000';
const STATUS_PENDING = 'pending';
const STATUS_CONFIRMED = 'confirmed';
const STATUS_CANCELLED = 'cancelled';

function toDecimal(v: string | number): string {
  return typeof v === 'number' ? v.toFixed(2) : String(v);
}

function parseDecimal(s: string | null | undefined): number {
  if (s == null) return 0;
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Creates a reservation for the given slot and format. Validates slot capacity and applies
 * format price + reservation surcharge. Processes payment stub and increments slot booked_count.
 */
export async function createReservation(
  userId: string,
  stationId: string,
  timeSlotId: string,
  vehicleFormatId: string
): Promise<Entry> {
  const slot = await findSlotByIdAndStation(timeSlotId, stationId);
  if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');
  const format = await findFormatByIdAndStation(vehicleFormatId, stationId);
  if (!format) throw new NotFoundError('Vehicle format not found');
  const config = await getConfigByStationId(stationId);
  const surcharge = config?.reservation_surcharge
    ? parseDecimal(String(config.reservation_surcharge))
    : 0;
  const formatPrice = parseDecimal(String(format.price));
  const amountTotal = formatPrice + surcharge;
  if (amountTotal <= 0) throw new ConflictError('Invalid amount');

  const count = await countReservationsBySlotId(timeSlotId);
  if (count >= (slot.capacity ?? 0)) throw new ConflictError('Slot is full');

  const payment = await processPayment({
    amountCents: Math.round(amountTotal * 100),
    userId,
    stationId,
    metadata: { time_slot_id: timeSlotId, vehicle_format_id: vehicleFormatId },
  });
  if (!payment.success) throw new ConflictError(payment.error ?? 'Payment failed');

  const commissionRate = DEFAULT_COMMISSION_RATE;
  const commissionAmount = amountTotal * parseFloat(commissionRate);
  const stationPayout = amountTotal - commissionAmount;

  const entry = await createReservationEntry({
    user_id: userId,
    station_id: stationId,
    vehicle_format_id: vehicleFormatId,
    time_slot_id: timeSlotId,
    status: STATUS_PENDING,
    amount_paid: toDecimal(amountTotal),
    commission_rate: commissionRate,
    commission_amount: toDecimal(commissionAmount),
    station_payout: toDecimal(stationPayout),
    stripe_payment_id: payment.stripePaymentId ?? null,
  });
  await incrementSlotBookedCount(timeSlotId);
  await notifyEntry({
    entryId: entry.id,
    userId,
    stationId,
    type: 'reservation_created',
  });
  return entry;
}

/**
 * Cancels an entry (reservation or queue). For reservations, decrements slot booked_count.
 */
export async function cancelEntry(entryId: string, userId: string): Promise<Entry> {
  const entry = await findEntryByIdAndUser(entryId, userId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.status === STATUS_CANCELLED) throw new ConflictError('Entry already cancelled');
  if (entry.entry_type === 'reservation' && entry.time_slot_id) {
    await decrementSlotBookedCount(entry.time_slot_id);
  }
  const updated = await updateEntry(entryId, {
    status: STATUS_CANCELLED,
    updated_at: new Date(),
  });
  await notifyEntry({
    entryId,
    userId,
    stationId: entry.station_id,
    type: 'entry_cancelled',
  });
  return updated;
}

/**
 * Returns all entries (reservations and queue) for the user, most recent first.
 */
export async function listMyEntries(userId: string): Promise<Entry[]> {
  return listEntriesByUser(userId);
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

  const slot = await findSlotByIdAndStation(timeSlotId, stationId);
  if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');
  const count = await countReservationsBySlotId(timeSlotId);
  if (count >= (slot.capacity ?? 0)) throw new ConflictError('Slot is full');

  const config = await getConfigByStationId(stationId);
  const surcharge = config?.reservation_surcharge
    ? parseDecimal(String(config.reservation_surcharge))
    : 0;
  if (surcharge > 0) {
    const payment = await processPayment({
      amountCents: Math.round(surcharge * 100),
      userId,
      stationId,
      entryId,
      metadata: { time_slot_id: timeSlotId },
    });
    if (!payment.success) throw new ConflictError(payment.error ?? 'Payment failed');
  }

  const oldPosition = entry.queue_position ?? 0;
  await shiftQueuePositions(stationId, oldPosition, -1);
  const updated = await updateEntry(entryId, {
    entry_type: 'reservation',
    time_slot_id: timeSlotId,
    queue_position: null,
    status: STATUS_PENDING,
    updated_at: new Date(),
  });
  await incrementSlotBookedCount(timeSlotId);
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
