/**
 * In-app notifications pushed to the client's feed when station-side actions
 * impact one of their entries. Distinct from `notifyEntry` which targets the
 * client via FCM push (stub in dev); this layer drives `user_notifications`
 * and is surfaced in the client notification bell.
 *
 * All inserts are best-effort: a failed notification must never abort the
 * underlying state change - we log and swallow.
 */

import { getClientNotificationPrefs } from './user-notification-prefs-repository';
import { insertUserNotification } from './user-notifications-repository';

type ClientFeedKind =
  | 'delay_accepted'
  | 'delay_refused';

interface NotifyClientParams {
  userId: string;
  entryId: string;
  stationId: string;
  kind: ClientFeedKind;
  body: string;
}

/* Map each kind to the client preference key that gates delivery. Delay
 * accept/refuse falls under "wash_status" because it changes how the booking
 * will be honoured. */
const KIND_TO_PREF: Record<ClientFeedKind, keyof Awaited<ReturnType<typeof getClientNotificationPrefs>>> = {
  delay_accepted: 'wash_status',
  delay_refused: 'wash_status',
};

const TITLES: Record<ClientFeedKind, string> = {
  delay_accepted: 'Retard accepté',
  delay_refused: 'Retard refusé',
};

/**
 * Inserts a `user_notifications` row addressed to the client. Always
 * resolves: failures are logged but never thrown so the calling transaction
 * stays committed.
 */
export async function notifyClientFeed(params: NotifyClientParams): Promise<void> {
  try {
    const prefs = await getClientNotificationPrefs(params.userId);
    const prefKey = KIND_TO_PREF[params.kind];
    if (prefs[prefKey] === false) return;

    await insertUserNotification({
      user_id: params.userId,
      kind: params.kind,
      title: TITLES[params.kind],
      body: params.body,
      action_url: `/client/reservations/${params.entryId}`,
      payload: { entry_id: params.entryId, station_id: params.stationId },
    });
  } catch (e) {
    console.error('[CLIENT_FEED] Failed to insert client notification', {
      userId: params.userId,
      entryId: params.entryId,
      kind: params.kind,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
