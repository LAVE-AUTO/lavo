/**
 * Notification services (email, push, cron events).
 * Push notifications are dispatched via fcm-service (stub until Firebase is configured).
 * Used by reservation, queue, reminder, and pick flows.
 */

import { sendPushNotification } from './fcm-service';

export type NotifyEntryParams = {
  entryId: string;
  userId: string;
  stationId?: string;
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
    | 'reservation_reminder_24h'
    | 'reservation_reminder_2h'
    | 'reservation_reminder_1h'
    | 'service_started'
    | 'service_completed'
    | 'client_late'
    | 'queue_pick'
    | 'queue_position_changed'
    | 'reservation_rescheduled'
    | 'reschedule_station_notified'
    | 'delay_request_received'
    | 'delay_accepted'
    | 'delay_refused'
    | 'support_ticket_created'
    | 'support_message_received'
    | 'tip_received'
    | 'tip_sent'
    | 'extra_time_delay'
    | 'slot_beyond_closing'
    | 'queue_cancelled_by_client'
    | 'queue_no_show';
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
  reservation_reminder_24h: { title: 'Reminder: reservation tomorrow', body: 'You have a reservation scheduled for tomorrow. Get ready!' },
  reservation_reminder_2h: { title: 'Reminder: reservation in 2 hours', body: 'Your appointment is coming up in 2 hours. Do not forget!' },
  reservation_reminder_1h: { title: 'Reminder: reservation in 1 hour', body: 'Your appointment is in 1 hour. Please head over soon.' },
  service_started: { title: 'Service started', body: 'Your car wash has begun. We will notify you when it is complete.' },
  service_completed: { title: 'Service complete', body: 'Your car wash is done! Come pick up your vehicle.' },
  client_late: { title: 'You have been moved to the walk-in queue', body: 'Your reservation window has passed. You are now at the front of the walk-in queue.' },
  queue_pick: { title: 'It is your turn!', body: 'The station is ready for you. Please proceed to the wash bay.' },
  queue_position_changed: { title: 'Queue update', body: 'Your position in the queue has been updated.' },
  reservation_rescheduled: { title: 'Reservation rescheduled', body: 'Your reservation has been moved to a new time slot.' },
  reschedule_station_notified: { title: 'Reservation rescheduled', body: 'A client has rescheduled their reservation to a new time slot.' },
  delay_request_received: { title: 'Delay request received', body: 'A client has signaled they will be late for their reservation.' },
  delay_accepted: { title: 'Delay accepted', body: 'The station has accepted your late arrival. Please proceed as soon as possible.' },
  delay_refused: { title: 'Delay refused', body: 'The station cannot accommodate your late arrival. Please proceed to your appointment on time.' },
  support_ticket_created: { title: 'Support ticket created', body: 'Your request has been registered successfully.' },
  support_message_received: { title: 'New support message', body: 'You have received a reply to your support ticket.' },
  tip_received: { title: 'Tip received', body: 'A client has left you a tip for their recent service.' },
  tip_sent: { title: 'Tip sent', body: 'Your tip has been sent successfully. Thank you!' },
  extra_time_delay: { title: 'Appointment delayed', body: 'Your appointment has been delayed. Please check the app for your updated time.' },
  slot_beyond_closing: { title: 'Appointment moved past closing time', body: 'Due to a service overrun, your slot now falls outside station hours. You may cancel for a full refund or keep your appointment - the station will accommodate you.' },
  queue_cancelled_by_client: { title: 'Queue booking cancelled', body: 'You have cancelled your place in the queue. A cancellation fee has been applied.' },
  queue_no_show: { title: 'No-show: booking cancelled', body: 'Your queue booking has been cancelled because the station has closed for the day. A cancellation fee has been applied.' },
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
      data: {
        entry_id: params.entryId,
        ...(params.stationId && { station_id: params.stationId }),
        type: params.type,
      },
    });
  }
}


