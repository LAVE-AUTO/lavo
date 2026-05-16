/**
 * In-app notifications pushed to the station owner's feed when client-side
 * actions create or impact an entry. Distinct from `notifyEntry` which targets
 * the client via push (FCM); this layer drives `user_notifications` and is
 * surfaced in the station dashboard's notifications panel.
 *
 * All inserts are best-effort: a failed notification must never abort the
 * underlying entry creation - we log and swallow.
 */

import { findStationById, getNotificationPrefs } from '@/server/station/station-repository';
import { insertUserNotification } from './user-notifications-repository';

type StationFeedKind =
  | 'queue_new'
  | 'reservation_new'
  | 'reservation_cancelled_by_client'
  | 'queue_cancelled_by_client'
  | 'queue_upgraded_to_reservation'
  | 'delay_request';

interface NotifyStationParams {
  stationId: string;
  entryId: string;
  kind: StationFeedKind;
  /** Free-form summary like "Berline · 25.00$ · Code AB12CD". */
  body: string;
}

const KIND_TO_PREF: Record<StationFeedKind, string> = {
  queue_new: 'queue_new',
  reservation_new: 'reservation_new',
  reservation_cancelled_by_client: 'cancellations',
  queue_cancelled_by_client: 'cancellations',
  queue_upgraded_to_reservation: 'reservation_new',
  /* Reuse the cancellations preference: clients running late falls under the
   * same "schedule disruption" bucket from the merchant's point of view. */
  delay_request: 'cancellations',
};

const TITLES: Record<StationFeedKind, string> = {
  queue_new: 'Nouveau client en file',
  reservation_new: 'Nouvelle réservation',
  reservation_cancelled_by_client: 'Réservation annulée',
  queue_cancelled_by_client: 'File d\'attente annulée',
  queue_upgraded_to_reservation: 'Conversion file → réservation',
  delay_request: 'Demande de retard',
};


/**
 * Inserts a `user_notifications` row addressed to the station owner. Always
 * resolves: failures are logged but never thrown so the calling transaction
 * stays committed.
 */
export async function notifyStationFeed(params: NotifyStationParams): Promise<void> {
  try {
    const [station, prefs] = await Promise.all([
      findStationById(params.stationId),
      getNotificationPrefs(params.stationId),
    ]);
    if (!station?.user_id) return;
    // Deny-by-default: an unknown kind has no mapped preference key, so we should
    // not deliver the notification rather than silently bypass user settings.
    const prefKey = KIND_TO_PREF[params.kind];
    if (!prefKey) return;
    if (prefs && prefs[prefKey] === false) return;
    /* Delay requests have a dedicated review page; everything else points back
     * to the dashboard summary. */
    const actionUrl = params.kind === 'delay_request' ? '/station/delays' : '/station/dashboard';
    await insertUserNotification({
      user_id: station.user_id,
      kind: params.kind,
      title: TITLES[params.kind],
      body: params.body,
      action_url: actionUrl,
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
