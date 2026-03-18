/**
 * Queue business logic: join queue, list queue, move reservation to queue (cron).
 * Uses entry repository, queue-position helper, slot repo (decrement booked_count), notification stub.
 * Walk-in queue entries are free of charge — payment only applies to reservations.
 */
import { NotFoundError, ConflictError } from '@/lib/errors';
import { db } from '@/lib/db';
import { findFormatByIdAndStation } from '@/server/station/format-repository';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';
import { capturePaymentIntent } from '@/server/payments/payment-service';
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

const STATUS_PENDING = 'pending';
const STATUS_LATE = 'late';

/**
 * Joins the walk-in queue at the station for the given vehicle format. No payment required.
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

  const entry = await createQueueEntry({
    user_id: userId,
    station_id: stationId,
    vehicle_format_id: vehicleFormatId,
    queue_position: nextPos,
    status: STATUS_PENDING,
    amount_paid: '0.00',
    commission_rate: '0.00',
    commission_amount: '0.00',
    station_payout: '0.00',
    stripe_payment_id: null,
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
 *
 * Payment policy for late clients: no refund — the Stripe PaymentIntent is captured immediately so
 * funds are distributed between the station and the platform as if the service had been rendered.
 * The client is moved to the walk-in queue and handled later by the station.
 */
export async function moveReservationToQueue(entryId: string): Promise<Entry> {
  const entry = await findEntryById(entryId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.entry_type !== 'reservation') throw new ConflictError('Entry is not a reservation');
  if (!entry.time_slot_id) throw new ConflictError('Reservation has no time slot');

  const stationId = entry.station_id;

  // Atomic: compute new position, shift queue, convert entry, decrement slot — all or nothing.
  await db.transaction(async (tx) => {
    const existingCount = await countQueueByStation(stationId, tx);
    const newPosition = getQueuePositionWhenMovingFromReservation(stationId, {
      existingQueueCount: existingCount,
    });
    await shiftQueuePositions(stationId, newPosition, 1, tx);
    await updateEntry(entryId, {
      entry_type: 'queue',
      time_slot_id: null,
      queue_position: newPosition,
      status: STATUS_LATE,
      updated_at: new Date(),
    }, tx);
    await decrementSlotBookedCount(entry.time_slot_id!, tx);
  });

  // Capture the payment immediately — no refund for late clients.
  // Distribution (station payout + platform commission) happens at capture time.
  // Kept outside the transaction: Stripe is an external call and must not hold DB locks.
  if (entry.stripe_payment_id) {
    try {
      await capturePaymentIntent(entry.stripe_payment_id);
    } catch (e) {
      console.error('[CAPTURE_FAILED] Late entry moved to queue but Stripe capture failed — manual resolution required', {
        entryId,
        stripe_payment_id: entry.stripe_payment_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await notifyEntry({
    entryId,
    userId: entry.user_id,
    stationId,
    type: 'moved_to_queue',
  });
  return (await findEntryById(entryId))!;
}

/**
 * Station picks a client from the walk-in queue (assigns in_progress status).
 * Atomically: sets entry to in_progress, clears queue_position, shifts remaining entries up.
 * Notifies the picked client and the other clients whose position changed.
 */
export async function pickQueueEntry(stationId: string, queueEntryId: string): Promise<Entry> {
  const entry = await findEntryById(queueEntryId);
  if (!entry) throw new NotFoundError('Queue entry not found');
  if (entry.station_id !== stationId) throw new NotFoundError('Queue entry does not belong to this station');
  if (entry.entry_type !== 'queue') throw new ConflictError('Entry is not a queue entry');
  if (entry.status === 'in_progress') throw new ConflictError('Client is already being served');
  if (!['pending', 'late'].includes(entry.status)) {
    throw new ConflictError(`Cannot pick an entry with status '${entry.status}'`);
  }

  const pickedPosition = entry.queue_position ?? 0;

  const updated = await db.transaction(async (tx) => {
    const result = await updateEntry(queueEntryId, { status: 'in_progress', queue_position: null }, tx);
    if (pickedPosition > 0) {
      await shiftQueuePositions(stationId, pickedPosition + 1, -1, tx);
    }
    return result;
  });

  try {
    await notifyEntry({
      entryId: queueEntryId,
      userId: entry.user_id,
      stationId,
      type: 'queue_pick',
    });
  } catch (e) {
    console.error('Failed to send pick notification for entry', queueEntryId, e);
  }

  return updated;
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

  // Atomic: shift affected entries and update this entry's position in one transaction.
  return db.transaction(async (tx) => {
    if (newPosition < oldPosition) {
      await shiftQueuePositions(stationId, newPosition, 1, tx);
    } else {
      await shiftQueuePositions(stationId, oldPosition + 1, -1, tx);
    }
    return updateEntry(entryId, { queue_position: newPosition, updated_at: new Date() }, tx);
  });
}
