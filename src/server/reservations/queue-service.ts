/**
 * Queue business logic: join queue, list queue, move reservation to queue (cron).
 * Uses entry repository, queue-position helper, slot repo (decrement booked_count), notification stub.
 * Walk-in queue entries require Stripe payment (authorized at join time, captured on completion).
 */
import { NotFoundError, ConflictError } from '@/lib/errors';
import { db } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { reservations as reservationsTable } from '@/lib/db/schema';
import { findServiceVehicleEntryForBooking, findServiceByIdAndStation } from '@/server/station/service-repository';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';
import { createPaymentIntent, cancelPaymentIntent, updatePaymentIntentMetadata } from '@/server/payments/payment-service';
import { findById } from '@/server/auth/user-repository';
import { notifyEntry } from '@/server/notifications/notification-service';
import { notifyStationFeed } from '@/server/notifications/station-feed-notifications';
import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';
import { getQueuePositionWhenMovingFromReservation } from './queue-position-helper';
import { generateTicketCode } from './ticket-code';
import {
  createQueueEntry,
  findEntryById,
  listQueueByStation,
  countQueueByStation,
  getNextQueuePosition,
  hasActiveQueueEntryAtStation,
  findPendingPaymentQueueEntryAtStation,
  updateEntry,
  shiftQueuePositions,
  findFirstActiveQueueEntry,
  type Entry,
} from './entry-repository';
import { computeReservationSplit } from './compute-reservation-split';

export type JoinQueueResult = { entry: Entry; clientSecret: string };

const STATUS_PENDING_PAYMENT = 'pending_payment';
const STATUS_LATE = 'late';

/**
 * Joins the walk-in queue at the station for the given vehicle format.
 * Payment is required: a Stripe PaymentIntent is authorized at join time and captured on service completion.
 * Assigns queue_position at end of queue.
 *
 * Stripe-first pattern: PI is created before the DB entry so there is no crash window where an
 * entry exists with stripe_payment_id = null. If the DB transaction fails (duplicate, race), the PI
 * is never returned to the client and auto-expires on Stripe after 24h - no charge, no orphan.
 */
export async function joinQueue(
  userId: string,
  stationId: string,
  serviceId: string,
  vehicleFormatId: string | null | undefined,
  stationStripeAccountId: string
): Promise<JoinQueueResult> {
  const service = await findServiceByIdAndStation(serviceId, stationId);
  if (!service) throw new NotFoundError('Service not found');

  const vehicleEntry = await findServiceVehicleEntryForBooking(serviceId, vehicleFormatId ?? null);
  if (!vehicleEntry) throw new NotFoundError('Service pricing entry not found for this format');
  if (!vehicleEntry.is_active) throw new ConflictError('Service entry is not active');

  const entryPrice = parseFloat(String(vehicleEntry.price));
  const split = await computeReservationSplit({ amountTotal: entryPrice, isQrBooking: false });

  const amountCents = Math.round(entryPrice * 100);
  const commissionCents = Math.round(split.commissionAmount * 100);

  // Cancel any stale pending_payment queue entry before creating a new PI.
  // Allows users to retry after abandoning the Stripe form.
  //
  // The cancel + shift must run atomically (bug #8): two concurrent join attempts from the
  // same user could otherwise both observe the same stalePending and each apply the shift,
  // double-decrementing queue positions and corrupting the queue for the whole station.
  // We use a conditional UPDATE so only the first transaction wins; subsequent ones see no
  // matching row and skip the shift.
  const stalePending = await findPendingPaymentQueueEntryAtStation(userId, stationId);
  if (stalePending) {
    let wonRace = false;
    let stripePaymentIdToCancel: string | null = null;
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(reservationsTable)
        .set({ status: 'cancelled', queue_position: null, updated_at: new Date() })
        .where(
          and(
            eq(reservationsTable.id, stalePending.id),
            eq(reservationsTable.status, 'pending_payment')
          )
        )
        .returning({
          id: reservationsTable.id,
          stripe_payment_id: reservationsTable.stripe_payment_id,
        });
      if (!updated) return; // another concurrent call already handled this stale entry.
      wonRace = true;
      stripePaymentIdToCancel = updated.stripe_payment_id;
      if (stalePending.queue_position != null) {
        await shiftQueuePositions(stationId, stalePending.queue_position + 1, -1, tx);
      }
    });
    if (wonRace && stripePaymentIdToCancel) {
      try {
        await cancelPaymentIntent(stripePaymentIdToCancel);
      } catch {
        // Non-fatal: PI may already be expired
      }
    }
  }

  // Idempotency key: scoped to (user, station, service, vehicle, minute). A network-retry from
  // the client within the same minute returns the same PI rather than producing a second
  // authorization hold on the card.
  const piIdempotencyKey = `pi-create:queue:${userId}:${stationId}:${serviceId}:${vehicleFormatId ?? 'na'}:${Math.floor(Date.now() / 60_000)}`;
  const { paymentIntentId, clientSecret } = await createPaymentIntent({
    amountCents,
    userId,
    stationId,
    stationStripeAccountId,
    commissionCents,
    idempotencyKey: piIdempotencyKey,
    metadata: {
      service_id: serviceId,
      vehicle_format_id: vehicleFormatId ?? '',
      entry_type: 'queue',
    },
  });

  const entry = await db.transaction(async (tx) => {
    const hasActive = await hasActiveQueueEntryAtStation(userId, stationId, tx);
    if (hasActive) throw new ConflictError('You already have an active queue entry at this station');

    const nextPos = await getNextQueuePosition(stationId, tx);

    return createQueueEntry({
      user_id: userId,
      station_id: stationId,
      vehicle_format_id: vehicleFormatId ?? null,
      service_id: serviceId,
      queue_position: nextPos,
      status: STATUS_PENDING_PAYMENT,
      amount_paid: String(entryPrice.toFixed(2)),
      commission_rate: split.commissionRate,
      commission_amount: String(split.commissionAmount.toFixed(2)),
      station_payout: String(split.stationPayout.toFixed(2)),
      stripe_payment_id: paymentIntentId,
      ticket_code: generateTicketCode(),
    }, tx);
  });

  // Update PI metadata with reservation_id now that the entry ID is known.
  // Non-fatal: metadata is informational only; webhook resolution uses stripe_payment_id on the entry.
  try {
    await updatePaymentIntentMetadata(paymentIntentId, { reservation_id: entry.id });
  } catch (e) {
    console.error('[JOIN_QUEUE] PI metadata update failed - non-fatal', {
      entryId: entry.id,
      paymentIntentId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  await notifyEntry({
    entryId: entry.id,
    userId,
    stationId,
    type: 'queue_joined',
  });
  await notifyClientFeed({
    userId,
    entryId: entry.id,
    stationId,
    kind: 'queue_joined',
    body: "Vous êtes dans la file d'attente. Vous serez notifié quand ce sera votre tour.",
  });

  /* Push to the station owner's in-app feed (best-effort, never blocks). */
  const client = await findById(userId);
  const clientName = client?.first_name ?? 'Un client';
  await notifyStationFeed({
    stationId,
    entryId: entry.id,
    kind: 'queue_new',
    body: `${clientName} a rejoint la file d'attente (${entryPrice.toFixed(2)} $)`,
  });

  return { entry, clientSecret };
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
 * Payment policy for late clients: no refund - the Stripe PaymentIntent is captured immediately so
 * funds are distributed between the station and the platform as if the service had been rendered.
 * The client is moved to the walk-in queue and handled later by the station.
 */
export async function moveReservationToQueue(entryId: string): Promise<Entry> {
  const entry = await findEntryById(entryId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.entry_type !== 'reservation') throw new ConflictError('Entry is not a reservation');
  if (!entry.time_slot_id) throw new ConflictError('Reservation has no time slot');

  const stationId = entry.station_id;

  // Atomic: compute new position, shift queue, convert entry, decrement slot - all or nothing.
  const updated = await db.transaction(async (tx) => {
    const existingCount = await countQueueByStation(stationId, tx);
    const newPosition = getQueuePositionWhenMovingFromReservation(stationId, {
      existingQueueCount: existingCount,
    });
    await shiftQueuePositions(stationId, newPosition, 1, tx);
    const result = await updateEntry(entryId, {
      entry_type: 'queue',
      time_slot_id: null,
      queue_position: newPosition,
      status: STATUS_LATE,
      updated_at: new Date(),
    }, tx);
    await decrementSlotBookedCount(entry.time_slot_id!, tx);
    return result;
  });

  // Payment is NOT captured here. The PaymentIntent stays authorized.
  // Capture happens on service completion (station marks completed) or cancellation/no-show
  // (cancellation fee applied at that point). This mirrors the walk-in queue payment flow.

  await notifyEntry({
    entryId,
    userId: entry.user_id,
    stationId,
    type: 'moved_to_queue',
  });
  await notifyClientFeed({
    userId: entry.user_id,
    entryId,
    stationId,
    kind: 'moved_to_queue',
    body: "Votre créneau est passé. Vous avez été placé en tête de file d'attente.",
  });
  return updated;
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
  if (!['pending', 'confirmed', 'late'].includes(entry.status)) {
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
    await notifyClientFeed({
      userId: entry.user_id,
      entryId: queueEntryId,
      stationId,
      kind: 'queue_pick',
      body: 'La station est prête pour vous. Rendez-vous à la baie de lavage.',
    });
  } catch (e) {
    console.error('Failed to send pick notification for entry', queueEntryId, e);
  }

  return updated;
}

/**
 * Picks the first active client in the walk-in queue (lowest queue_position).
 * Used by POST /api/v1/station/queue/next to automatically serve the next client in line.
 *
 * Equivalent to pickQueueEntry on the entry with the smallest queue_position.
 * Throws NotFoundError if the queue is empty (no active entries).
 */
export async function callNextInQueue(stationId: string): Promise<Entry> {
  const next = await findFirstActiveQueueEntry(stationId);
  if (!next) throw new NotFoundError('No active clients in queue');
  return pickQueueEntry(stationId, next.id);
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
