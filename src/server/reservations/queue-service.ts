/**
 * Queue business logic: join queue, list queue, move reservation to queue (cron).
 * Uses entry repository, queue-position helper, slot repo (decrement booked_count), notification stub.
 */
import { NotFoundError, ConflictError } from '@/lib/errors';
import { findFormatByIdAndStation } from '@/server/station/format-repository';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';
import { processPayment } from '@/server/payments/payment-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import { getQueuePositionWhenMovingFromReservation } from './queue-position-helper';
import {
  createQueueEntry,
  findEntryById,
  listQueueByStation,
  countQueueByStation,
  getNextQueuePosition,
  updateEntry,
  shiftQueuePositions,
  type Entry,
} from './entry-repository';

const DEFAULT_COMMISSION_RATE = '0.1000';
const STATUS_PENDING = 'pending';
const STATUS_LATE = 'late';

function toDecimal(v: string | number): string {
  return typeof v === 'number' ? v.toFixed(2) : String(v);
}

function parseDecimal(s: string | null | undefined): number {
  if (s == null) return 0;
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Joins the queue at the station for the given vehicle format. Charges format price only.
 * Assigns queue_position at end of queue.
 */
export async function joinQueue(
  userId: string,
  stationId: string,
  vehicleFormatId: string
): Promise<Entry> {
  const format = await findFormatByIdAndStation(vehicleFormatId, stationId);
  if (!format) throw new NotFoundError('Vehicle format not found');
  if (!format.is_active) throw new ConflictError('Format is not active');

  const nextPos = await getNextQueuePosition(stationId);
  const amountTotal = parseDecimal(String(format.price));
  if (amountTotal <= 0) throw new ConflictError('Invalid format price');

  const payment = await processPayment({
    amountCents: Math.round(amountTotal * 100),
    userId,
    stationId,
    metadata: { vehicle_format_id: vehicleFormatId, queue_position: String(nextPos) },
  });
  if (!payment.success) throw new ConflictError(payment.error ?? 'Payment failed');

  const commissionRate = DEFAULT_COMMISSION_RATE;
  const commissionAmount = amountTotal * parseFloat(commissionRate);
  const stationPayout = amountTotal - commissionAmount;

  const entry = await createQueueEntry({
    user_id: userId,
    station_id: stationId,
    vehicle_format_id: vehicleFormatId,
    queue_position: nextPos,
    status: STATUS_PENDING,
    amount_paid: toDecimal(amountTotal),
    commission_rate: commissionRate,
    commission_amount: toDecimal(commissionAmount),
    station_payout: toDecimal(stationPayout),
    stripe_payment_id: payment.stripePaymentId ?? null,
  });
  await notifyEntry({
    entryId: entry.id,
    userId,
    stationId,
    type: 'queue_joined',
  });
  return entry;
}

/**
 * Lists queue entries for the station, ordered by queue_position.
 */
export async function listQueue(stationId: string): Promise<Entry[]> {
  return listQueueByStation(stationId);
}

/**
 * Moves a reservation to the queue (downgrade). Used by cron for late unconfirmed reservations.
 * Uses queue-position helper for new position; shifts existing queue entries; decrements slot booked_count.
 */
export async function moveReservationToQueue(entryId: string): Promise<Entry> {
  const entry = await findEntryById(entryId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.entry_type !== 'reservation') throw new ConflictError('Entry is not a reservation');
  if (!entry.time_slot_id) throw new ConflictError('Reservation has no time slot');

  const stationId = entry.station_id;
  const existingCount = await countQueueByStation(stationId);
  const newPosition = getQueuePositionWhenMovingFromReservation(stationId, {
    existingQueueCount: existingCount,
  });

  if (newPosition === 1) {
    await shiftQueuePositions(stationId, 1, 1);
  } else {
    await shiftQueuePositions(stationId, newPosition, 1);
  }
  await updateEntry(entryId, {
    entry_type: 'queue',
    time_slot_id: null,
    queue_position: newPosition,
    status: STATUS_LATE,
    updated_at: new Date(),
  });
  await decrementSlotBookedCount(entry.time_slot_id);
  await notifyEntry({
    entryId,
    userId: entry.user_id,
    stationId,
    type: 'moved_to_queue',
  });
  return (await findEntryById(entryId))!;
}

/**
 * Updates a queue entry's position (reorder). Used by PATCH /station/entries/:entryId/position.
 * Shifts other entries so the new position is free, then sets this entry's queue_position.
 */
export async function updateEntryPosition(
  entryId: string,
  stationId: string,
  newPosition: number
): Promise<Entry> {
  const entry = await findEntryById(entryId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.station_id !== stationId) throw new NotFoundError('Entry does not belong to this station');
  if (entry.entry_type !== 'queue') throw new ConflictError('Entry is not a queue entry');

  const oldPosition = entry.queue_position ?? 0;
  if (oldPosition === newPosition) return entry;

  if (newPosition < oldPosition) {
    await shiftQueuePositions(stationId, newPosition, 1);
  } else if (newPosition > oldPosition) {
    await shiftQueuePositions(stationId, oldPosition + 1, -1);
  }
  const updated = await updateEntry(entryId, {
    queue_position: newPosition,
    updated_at: new Date(),
  });
  return updated;
}
