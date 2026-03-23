/**
 * Delay request business logic: client signals a late arrival, station accepts or refuses.
 * Delay requests are a communication layer on top of the existing reservation workflow.
 * They do NOT alter the reservation status — the cron remains the sole arbiter of actual
 * late detection and queue downgrade.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { delayRequests } from '@/lib/db/schema';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { findStationById } from '@/server/station/station-repository';
import { notifyEntry } from '@/server/notifications/notification-service';
import { findEntryByIdAndStation, findEntryByIdAndUser } from './entry-repository';

export type DelayRequest = typeof delayRequests.$inferSelect;

const ACTIVE_DELAY_STATUSES = ['pending', 'accepted'] as const;
const SIGNAL_ALLOWED_STATUSES = ['confirmed'] as const;

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

  return row;
}

/**
 * Station accepts a pending delay request.
 * Updates status to 'accepted' and notifies the client.
 * The reservation status is unchanged — normal cron processing continues.
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

  return updated;
}

/**
 * Station refuses a pending delay request.
 * Updates status to 'refused' and notifies the client.
 * The reservation status is unchanged — normal cron processing continues.
 */
export async function refuseDelay(
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
    .set({ status: 'refused', updated_at: new Date() })
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

  return updated;
}
