/**
 * Cron job: send push reminders to clients with upcoming confirmed reservations.
 * Two reminder windows:
 *   - 5h  before: notifies clients to keep their appointment in mind.
 *   - 30min before: notifies clients to confirm their presence via the app.
 *
 * Each window uses a ±7-minute tolerance (14-minute slot) to cover cron drift.
 * Invoked by GET /api/cron/send-reservation-reminders (with CRON_SECRET header).
 */
import { listReservationsForReminder } from '@/server/reservations/entry-repository';
import { notifyEntry } from '@/server/notifications/notification-service';

const WINDOW_5H_MINUTES = 300;
const WINDOW_30MIN_MINUTES = 30;
const TOLERANCE_MINUTES = 7;

export type SendRemindersResult = {
  reminders_5h: { processed: number; succeeded: number; failed: number };
  reminders_30min: { processed: number; succeeded: number; failed: number };
};

async function sendRemindersForWindow(
  windowMinutes: number,
  type: 'reservation_reminder_5h' | 'reservation_reminder_30min'
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const entries = await listReservationsForReminder(windowMinutes, TOLERANCE_MINUTES);
  let succeeded = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      await notifyEntry({
        entryId: entry.id,
        userId: entry.user_id,
        stationId: entry.station_id,
        type,
      });
      succeeded += 1;
    } catch (e) {
      failed += 1;
      console.error(`[send-reminders] Failed to notify entry ${entry.id}:`, e);
    }
  }

  return { processed: entries.length, succeeded, failed };
}

export async function runSendReservationReminders(): Promise<SendRemindersResult> {
  const [reminders_5h, reminders_30min] = await Promise.all([
    sendRemindersForWindow(WINDOW_5H_MINUTES, 'reservation_reminder_5h'),
    sendRemindersForWindow(WINDOW_30MIN_MINUTES, 'reservation_reminder_30min'),
  ]);
  return { reminders_5h, reminders_30min };
}
