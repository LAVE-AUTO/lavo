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
import { fetchNotificationContext, appendContextToBody } from './notification-context';

export type ClientFeedKind =
  | 'reservation_created'
  | 'reservation_confirmed'
  | 'payment_failed'
  | 'queue_joined'
  | 'moved_to_queue'
  | 'entry_cancelled'
  | 'reservation_cancelled'
  | 'queue_cancelled_by_client'
  | 'queue_no_show'
  | 'service_started'
  | 'service_completed'
  | 'client_late'
  | 'queue_pick'
  | 'queue_position_changed'
  | 'reservation_rescheduled'
  | 'extra_time_delay'
  | 'slot_beyond_closing'
  | 'delay_accepted'
  | 'delay_refused'
  | 'invitation_to_rate'
  | 'support_ticket_created'
  | 'support_message_received'
  | 'tip_sent'
  | 'reservation_reminder_24h'
  | 'reservation_reminder_2h'
  | 'reservation_reminder_1h'
  | 'reservation_reminder_5h'
  | 'reservation_reminder_30min';

export interface NotifyClientParams {
  userId: string;
  entryId: string;
  stationId?: string;
  kind: ClientFeedKind;
  body: string;
  reminderMinutes?: number;
}

/* Map each kind to the client preference key that gates delivery. */
const KIND_TO_PREF: Record<ClientFeedKind, keyof Awaited<ReturnType<typeof getClientNotificationPrefs>>> = {
  reservation_created:       'wash_status',
  reservation_confirmed:     'wash_status',
  payment_failed:            'wash_status',
  queue_joined:              'wash_status',
  moved_to_queue:            'wash_status',
  entry_cancelled:           'wash_status',
  reservation_cancelled:     'wash_status',
  queue_cancelled_by_client: 'wash_status',
  queue_no_show:             'wash_status',
  service_started:           'wash_status',
  service_completed:         'wash_status',
  client_late:               'wash_status',
  queue_pick:                'wash_status',
  queue_position_changed:    'wash_status',
  reservation_rescheduled:   'wash_status',
  extra_time_delay:          'wash_status',
  slot_beyond_closing:       'wash_status',
  delay_accepted:            'wash_status',
  delay_refused:             'wash_status',
  invitation_to_rate:        'review',
  support_ticket_created:    'wash_status',
  support_message_received:  'wash_status',
  tip_sent:                  'wash_status',
  reservation_reminder_24h:  'reminder',
  reservation_reminder_2h:   'reminder',
  reservation_reminder_1h:   'reminder',
  reservation_reminder_5h:   'reminder',
  reservation_reminder_30min:'reminder',
};

const TITLES: Record<ClientFeedKind, string> = {
  reservation_created:       'Réservation créée',
  reservation_confirmed:     'Paiement reçu',
  payment_failed:            'Paiement échoué',
  queue_joined:              "File d'attente rejointe",
  moved_to_queue:            "Déplacé en file d'attente",
  entry_cancelled:           'Réservation annulée',
  reservation_cancelled:     'Réservation annulée',
  queue_cancelled_by_client: "File d'attente annulée",
  queue_no_show:             'Absence : réservation annulée',
  service_started:           'Service démarré',
  service_completed:         'Service terminé',
  client_late:               "Déplacé en file d'attente",
  queue_pick:                "C'est votre tour !",
  queue_position_changed:    'Position mise à jour',
  reservation_rescheduled:   'Réservation replanifiée',
  extra_time_delay:          'Retard de rendez-vous',
  slot_beyond_closing:       'Créneau dépassant la fermeture',
  delay_accepted:            'Retard accepté',
  delay_refused:             'Retard refusé',
  invitation_to_rate:        'Donnez votre avis',
  support_ticket_created:    'Ticket de support créé',
  support_message_received:  'Nouveau message de support',
  tip_sent:                  'Pourboire envoyé',
  reservation_reminder_24h:  'Rappel : réservation demain',
  reservation_reminder_2h:   'Rappel : réservation dans 2 heures',
  reservation_reminder_1h:   'Rappel : réservation dans 1 heure',
  reservation_reminder_5h:   'Rappel : réservation dans 5 heures',
  reservation_reminder_30min:'Rappel : réservation dans 30 minutes',
};

function resolveActionUrl(kind: ClientFeedKind, entryId: string): string {
  if (kind === 'support_ticket_created' || kind === 'support_message_received') {
    return '/client/support';
  }
  return `/client/reservations/${entryId}`;
}

function minutesToHumanFrench(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} heure${h > 1 ? 's' : ''}`);
  if (m > 0) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
  return parts.join(' ');
}

function resolveTitle(kind: ClientFeedKind, reminderMinutes?: number): string {
  if (reminderMinutes != null) {
    return `Rappel : réservation dans ${minutesToHumanFrench(reminderMinutes)}`;
  }
  return TITLES[kind];
}

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

    const ctx = await fetchNotificationContext(params.entryId);
    const enrichedBody = appendContextToBody(params.body, ctx);

    await insertUserNotification({
      user_id: params.userId,
      kind: params.kind,
      title: resolveTitle(params.kind, params.reminderMinutes),
      body: enrichedBody,
      action_url: resolveActionUrl(params.kind, params.entryId),
      payload: {
        entry_id: params.entryId,
        ...(params.stationId && { station_id: params.stationId }),
      },
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
