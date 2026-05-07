/**
 * In-app notifications pushed to the station owner's feed when client-side
 * actions create or impact an entry. Distinct from `notifyEntry` which targets
 * the client via push (FCM); this layer drives `user_notifications` and is
 * surfaced in the station dashboard's notifications panel.
 *
 * All inserts are best-effort: a failed notification must never abort the
 * underlying entry creation - we log and swallow.
 */
import { findStationById } from '@/server/station/station-repository';
import { insertUserNotification } from './user-notifications-repository';

type StationFeedKind = 'queue_new' | 'reservation_new';

interface NotifyStationParams {
  stationId: string;
  entryId: string;
  kind: StationFeedKind;
  /** Free-form summary like "Berline · 25.00$ · Code AB12CD". */
  body: string;
}

const TITLES: Record<StationFeedKind, string> = {
  queue_new: 'Nouveau client en file',
  reservation_new: 'Nouvelle réservation',
};

/**
 * Inserts a `user_notifications` row addressed to the station owner. Always
 * resolves: failures are logged but never thrown so the calling transaction
 * stays committed.
 */
export async function notifyStationFeed(params: NotifyStationParams): Promise<void> {
  try {
    const station = await findStationById(params.stationId);
    if (!station?.user_id) return;
    await insertUserNotification({
      user_id: station.user_id,
      kind: params.kind,
      title: TITLES[params.kind],
      body: params.body,
      action_url: '/station/dashboard',
      payload: { entry_id: params.entryId, station_id: params.stationId },
    });
  } catch (e) {
    console.error('[STATION_FEED] Failed to insert station notification', {
      stationId: params.stationId,
      entryId: params.entryId,
      kind: params.kind,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
