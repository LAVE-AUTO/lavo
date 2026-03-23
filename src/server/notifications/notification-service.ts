/**
 * Notification services (email, push, cron events).
 * Push notifications are dispatched via fcm-service (stub until Firebase is configured).
 * Used by reservation, queue, reminder, and pick flows.
 */
import { sendPushNotification } from './fcm-service';

export type NotifyEntryParams = {
  entryId: string;
  userId: string;
  stationId: string;
  type:
    | 'reservation_created'
    | 'reservation_confirmed'
    | 'payment_failed'
    | 'queue_joined'
    | 'moved_to_queue'
    | 'entry_cancelled'
    | 'reservation_cancelled'
    | 'invitation_to_rate'
    | 'reservation_reminder_5h'
    | 'reservation_reminder_30min'
    | 'client_late'
    | 'queue_pick'
    | 'queue_position_changed'
    | 'reservation_rescheduled'
    | 'reschedule_station_notified';
  payload?: Record<string, unknown>;
};

const PUSH_MESSAGES: Record<NotifyEntryParams['type'], { title: string; body: string }> = {
  reservation_created: { title: 'Reservation confirmed', body: 'Your booking has been registered. Complete payment to confirm.' },
  reservation_confirmed: { title: 'Payment received', body: 'Your reservation is confirmed. See you soon!' },
  payment_failed: { title: 'Payment failed', body: 'Your payment could not be processed. Please try again.' },
  queue_joined: { title: 'You joined the queue', body: 'You are in the walk-in queue. We will notify you when it is your turn.' },
  moved_to_queue: { title: 'Moved to walk-in queue', body: 'Your reservation time has passed. You have been placed at the front of the walk-in queue.' },
  entry_cancelled: { title: 'Booking cancelled', body: 'Your booking has been cancelled.' },
  reservation_cancelled: { title: 'Reservation cancelled', body: 'Your reservation has been cancelled and a refund has been initiated.' },
  invitation_to_rate: { title: 'How was your experience?', body: 'Rate your last visit to help us improve.' },
  reservation_reminder_5h: { title: 'Reminder: reservation in 5 hours', body: 'Do not forget to confirm your presence 30 minutes before your appointment.' },
  reservation_reminder_30min: { title: 'Your appointment is in 30 minutes', body: 'Please confirm your presence now so your slot is kept.' },
  client_late: { title: 'You have been moved to the walk-in queue', body: 'Your reservation window has passed. You are now at the front of the walk-in queue.' },
  queue_pick: { title: 'It is your turn!', body: 'The station is ready for you. Please proceed to the wash bay.' },
  queue_position_changed: { title: 'Queue update', body: 'Your position in the queue has been updated.' },
  reservation_rescheduled: { title: 'Reservation rescheduled', body: 'Your reservation has been moved to a new time slot.' },
  reschedule_station_notified: { title: 'Reservation rescheduled', body: 'A client has rescheduled their reservation to a new time slot.' },
};

/**
 * Sends a push notification for an entry event via FCM and logs the intent.
 */
export async function notifyEntry(params: NotifyEntryParams): Promise<void> {
  const message = PUSH_MESSAGES[params.type];
  if (message) {
    await sendPushNotification(params.userId, {
      title: message.title,
      body: message.body,
      data: { entry_id: params.entryId, station_id: params.stationId, type: params.type },
    });
  }
}

/**
 * Placeholder for notification services (legacy). Prefer notifyEntry.
 */
export function notificationServicePlaceholder() {
  // no-op; use notifyEntry for new flows
}

