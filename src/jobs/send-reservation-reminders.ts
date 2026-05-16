/**
 * Cron job: send push reminders to clients with upcoming confirmed reservations.
 *
 * Reminder windows:
 *   - 24 hours before: early heads-up
 *   - 2 hours before: preparation reminder
 *   - 1 hour before: imminent reminder
 *   - First configurable window (default 5 hours): legacy configurable window
 *   - Second configurable window (default 30 minutes): final confirmation window
 *
 * Tolerance: ±7 minutes on each window to accommodate cron drift and provider delays.
 * Each reminder attempt is independent; failure in one window doesn't block the others.
 *
 * Invocation: GET /api/cron/send-reservation-reminders with CRON_SECRET header
 * Response: summary counts (processed, succeeded, failed) per window
 */

import { listReservationsForReminder } from '@/server/reservations/entry-repository';
import { notifyEntry, type NotifyEntryParams } from '@/server/notifications/notification-service';
import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';
import { getPlatformSettingWithFallback } from '@/server/admin/platform-settings-service';
import { runWithConcurrencyLimit } from '@/helpers/concurrency';

const TOLERANCE_MINUTES = 7;

type ReminderType = Extract<
  NotifyEntryParams['type'],
  | 'reservation_reminder_24h'
  | 'reservation_reminder_2h'
  | 'reservation_reminder_1h'
  | 'reservation_reminder_5h'
  | 'reservation_reminder_30min'
>;

const REMINDER_FEED_BODY: Record<ReminderType, string> = {
  reservation_reminder_24h:  'Vous avez une réservation prévue demain.',
  reservation_reminder_2h:   'Votre réservation est dans 2 heures.',
  reservation_reminder_1h:   'Votre réservation est dans 1 heure.',
  reservation_reminder_5h:   'Votre réservation est dans 5 heures.',
  reservation_reminder_30min:'Votre réservation est dans 30 minutes.',
};

export type SendRemindersResult = {
  reminders_24h: { processed: number; succeeded: number; failed: number };
  reminders_2h: { processed: number; succeeded: number; failed: number };
  reminders_1h: { processed: number; succeeded: number; failed: number };
  reminders_5h: { processed: number; succeeded: number; failed: number };
  reminders_30min: { processed: number; succeeded: number; failed: number };
};


/**
 * Sends reminders for a single time window.
 * Failures are logged but never abort the batch.
 */
async function sendRemindersForWindow(
  windowMinutes: number,
  type: ReminderType,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const entries = await listReservationsForReminder(windowMinutes, TOLERANCE_MINUTES);
  let succeeded = 0;
  let failed = 0;

  const results = await runWithConcurrencyLimit(entries, 8, async (entry) => {
    await notifyEntry({
      entryId: entry.id,
      userId: entry.user_id,
      stationId: entry.station_id,
      type,
    });
    await notifyClientFeed({
      userId: entry.user_id,
      entryId: entry.id,
      stationId: entry.station_id,
      kind: type,
      body: REMINDER_FEED_BODY[type],
    });
  });

  for (const result of results) {
    if (result.status === 'fulfilled') {
      succeeded += 1;
    } else {
      failed += 1;
      console.error('[send-reminders] Failed to notify entry:', result.reason);
    }
  }

  return { processed: entries.length, succeeded, failed };
}

/**
 * Main job entry point: send reminders for all configured windows in parallel.
 * Fixed windows (24h, 2h, 1h) run alongside the two legacy configurable windows.
 */
export async function runSendReservationReminders(): Promise<SendRemindersResult> {
  const [firstHoursRaw, secondMinutesRaw] = await Promise.all([
    getPlatformSettingWithFallback('reminder_first_window_hours', 'PLATFORM_REMINDER_FIRST_WINDOW_HOURS', '5'),
    getPlatformSettingWithFallback('reminder_second_window_minutes', 'PLATFORM_REMINDER_SECOND_WINDOW_MINUTES', '30'),
  ]);

  const firstHoursParsed = parseInt(firstHoursRaw, 10);
  const firstWindowMinutes = (Number.isFinite(firstHoursParsed) && firstHoursParsed >= 1 ? firstHoursParsed : 5) * 60;
  const secondMinutesParsed = parseInt(secondMinutesRaw, 10);
  const secondWindowMinutes = Number.isFinite(secondMinutesParsed) && secondMinutesParsed >= 5 ? secondMinutesParsed : 30;

  const [reminders_24h, reminders_2h, reminders_1h, reminders_5h, reminders_30min] = await Promise.all([
    sendRemindersForWindow(24 * 60, 'reservation_reminder_24h'),
    sendRemindersForWindow(2 * 60, 'reservation_reminder_2h'),
    sendRemindersForWindow(1 * 60, 'reservation_reminder_1h'),
    sendRemindersForWindow(firstWindowMinutes, 'reservation_reminder_5h'),
    sendRemindersForWindow(secondWindowMinutes, 'reservation_reminder_30min'),
  ]);

  return { reminders_24h, reminders_2h, reminders_1h, reminders_5h, reminders_30min };
}
