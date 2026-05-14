/**
 * Delay request business logic: client signals a late arrival, station accepts or refuses.
 * Delay requests are a communication layer on top of the existing reservation workflow.
 * They do NOT alter the reservation status - the cron remains the sole arbiter of actual
 * late detection and queue downgrade.
 */
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { delayRequests } from '@/lib/db/schema';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { findStationById } from '@/server/station/station-repository';
import { notifyEntry } from '@/server/notifications/notification-service';
import { notifyStationFeed } from '@/server/notifications/station-feed-notifications';
import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';
import { findEntryByIdAndStation, findEntryByIdAndUser } from './entry-repository';
import {
  listDelayRequestsByStation,
  type DelayRequestWithReservation,
  type ListDelaysOptions,
} from './delay-repository';


// %%%%% Types %%%%%
// Delay request types and exports

export type DelayRequest = typeof delayRequests.$inferSelect;
export type { DelayRequestWithReservation, ListDelaysOptions };


// %%%%% Constants %%%%%
// Status enumerations for delay requests

const ACTIVE_DELAY_STATUSES = ['pending', 'accepted'] as const;
/* Frontend treats pending / pending_payment as visually confirmed (Stripe
 * settles asynchronously). Allow signalling for that whole set so the UX and
 * backend agree on what "confirmed" means from the client's perspective. */
const SIGNAL_ALLOWED_STATUSES = ['confirmed', 'pending', 'pending_payment'] as const;

// %%%%% List operations %%%%%
// Retrieve delay requests with optional filtering

/**
 * Returns a paginated list of delay requests for the given station.
 *
 * @param stationId - UUID of the authenticated station
 * @param options   - Optional status filter ('pending' | 'accepted' | 'refused' | 'all') and pagination
 */
export async function listDelaysByStation(
  stationId: string,
  options: ListDelaysOptions = {}
): Promise<{ rows: DelayRequestWithReservation[]; total: number; page: number; perPage: number }> {
  return listDelayRequestsByStation(stationId, options);
}


// %%%%% Signal delay %%%%%
// Client initiates a delay notification

/**
 * Client signals they will be late for their reservation.
 * Creates a delay request with status 'pending' and notifies the station manager.
 *
 * Rules:
 *   - Entry must be a reservation (not queue)
 *   - Reservation status must be 'confirmed'
 *   - No active (pending/accepted) delay request may already exist for this reservation
 */
export async function signalDelay(
  reservationId: string,
  userId: string,
  message?: string
): Promise<DelayRequest> {
  const entry = await findEntryByIdAndUser(reservationId, userId);
  if (!entry) throw new NotFoundError('Reservation not found');
  if (entry.entry_type !== 'reservation') throw new ConflictError('Entry is not a reservation');
  if (!SIGNAL_ALLOWED_STATUSES.includes(entry.status as typeof SIGNAL_ALLOWED_STATUSES[number])) {
    throw new ConflictError(`Cannot signal delay for a reservation with status '${entry.status}'`);
  }

  const existing = await db.query.delayRequests.findFirst({
    where: and(
      eq(delayRequests.reservation_id, reservationId),
      inArray(delayRequests.status, [...ACTIVE_DELAY_STATUSES])
    ),
  });
  if (existing) throw new ConflictError('A delay request is already active for this reservation');

  const [row] = await db
    .insert(delayRequests)
    .values({
      reservation_id: reservationId,
      user_id: userId,
      station_id: entry.station_id,
      status: 'pending',
      message: message ?? null,
    })
    .returning();
  if (!row) throw new Error('Insert delay request failed');

  const station = await findStationById(entry.station_id);
  const stationManagerId = station?.user_id ?? null;
  if (stationManagerId) {
    try {
      await notifyEntry({
        entryId: reservationId,
        userId: stationManagerId,
        stationId: entry.station_id,
        type: 'delay_request_received',
        payload: { client_message: message ?? null },
      });
    } catch (e) {
      console.error('[DELAY_SIGNAL] Failed to notify station manager', { reservationId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  /* Drop a row in the in-app feed so the merchant sees the bell badge update
   * even when FCM is not configured (typical in dev). The repo already gates
   * on the manager's notification preferences. */
  await notifyStationFeed({
    stationId: entry.station_id,
    entryId: reservationId,
    kind: 'delay_request',
    body: (message ?? '').trim().length > 0
      ? `Message du client : ${(message ?? '').trim().slice(0, 200)}`
      : 'Le client signale un retard pour sa réservation.',
  });

  return row;
}


// %%%%% Accept delay %%%%%
// Station approves a delay request

/**
 * Station accepts a pending delay request.
 * Updates status to 'accepted' and notifies the client.
 * The reservation status is unchanged - normal cron processing continues.
 */
export async function acceptDelay(
  reservationId: string,
  stationId: string
): Promise<DelayRequest> {
  const entry = await findEntryByIdAndStation(reservationId, stationId);
  if (!entry) throw new NotFoundError('Reservation not found');

  const delayRequest = await db.query.delayRequests.findFirst({
    where: and(
      eq(delayRequests.reservation_id, reservationId),
      eq(delayRequests.status, 'pending')
    ),
  });
  if (!delayRequest) throw new ConflictError('No pending delay request found for this reservation');

  const [updated] = await db
    .update(delayRequests)
    .set({ status: 'accepted', updated_at: new Date() })
    .where(eq(delayRequests.id, delayRequest.id))
    .returning();
  if (!updated) throw new Error('Update delay request failed');

  try {
    await notifyEntry({
      entryId: reservationId,
      userId: entry.user_id,
      stationId,
      type: 'delay_accepted',
    });
  } catch (e) {
    console.error('[DELAY_ACCEPT] Failed to notify client', { reservationId, error: e instanceof Error ? e.message : String(e) });
  }

  /* In-app feed: surfaces in the client's notification bell even when FCM
   * is not configured (typical in dev). */
  await notifyClientFeed({
    userId: entry.user_id,
    entryId: reservationId,
    stationId,
    kind: 'delay_accepted',
    body: 'La station accepte votre arrivée tardive. Présentez-vous dès que possible.',
  });

  return updated;
}


// %%%%% Refuse delay %%%%%
// Station rejects a delay request

/**
 * Station refuses a pending delay request.
 * Updates status to 'refused' and notifies the client.
 * The reservation status is unchanged - normal cron processing continues.
 */
export async function refuseDelay(
  reservationId: string,
  stationId: string,
  refusalReason?: string
): Promise<DelayRequest> {
  const entry = await findEntryByIdAndStation(reservationId, stationId);
  if (!entry) throw new NotFoundError('Reservation not found');

  const delayRequest = await db.query.delayRequests.findFirst({
    where: and(
      eq(delayRequests.reservation_id, reservationId),
      eq(delayRequests.status, 'pending')
    ),
  });
  if (!delayRequest) throw new ConflictError('No pending delay request found for this reservation');

  const [updated] = await db
    .update(delayRequests)
    .set({ status: 'refused', refusal_reason: refusalReason ?? null, updated_at: new Date() })
    .where(eq(delayRequests.id, delayRequest.id))
    .returning();
  if (!updated) throw new Error('Update delay request failed');

  try {
    await notifyEntry({
      entryId: reservationId,
      userId: entry.user_id,
      stationId,
      type: 'delay_refused',
    });
  } catch (e) {
    console.error('[DELAY_REFUSE] Failed to notify client', { reservationId, error: e instanceof Error ? e.message : String(e) });
  }

  await notifyClientFeed({
    userId: entry.user_id,
    entryId: reservationId,
    stationId,
    kind: 'delay_refused',
    body: refusalReason && refusalReason.trim().length > 0
      ? `La station ne peut pas vous accueillir en retard. Motif : ${refusalReason.trim().slice(0, 200)}`
      : 'La station ne peut pas vous accueillir en retard. Présentez-vous à l\'heure prévue.',
  });

  return updated;
}
