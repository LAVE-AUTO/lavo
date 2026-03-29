/**
 * Cron job: send push reminders to clients with upcoming confirmed reservations.
 *
 * Reminder windows (configurable via platform settings):
 *   - First window (default 5 hours): encourages clients to remember appointment
 *   - Second window (default 30 minutes): final confirmation to arrive on time
 *
 * Tolerance: ±7 minutes on each window to accommodate cron drift and provider delays.
 * Each reminder attempt is independent; failure in one window doesn't block the other.
 *
 * Invocation: GET /api/cron/send-reservation-reminders with CRON_SECRET header
 * Response: summary counts (processed, succeeded, failed) per window
 */
import { listReservationsForReminder } from '@/server/reservations/entry-repository';
import { notifyEntry } from '@/server/notifications/notification-service';
import { getPlatformSettingWithFallback } from '@/server/admin/platform-settings-service';


// %%%%% Constants %%%%%
// Tolerance for time window matching

const TOLERANCE_MINUTES = 7;


// %%%%% Types %%%%%
// Job result reporting

export type SendRemindersResult = {
  reminders_5h: { processed: number; succeeded: number; failed: number };
  reminders_30min: { processed: number; succeeded: number; failed: number };
};


// %%%%% Job execution %%%%%
// Query, notify, track results per window

/**
 * Sends reminders for a single time window.
 *
 * Queries all confirmed reservations in the window, attempts to notify each,
 * and collects success/failure counts. Failures are logged but don't stop the batch.
 *
 * @param windowMinutes - Minutes before service start time for this window
 * @param type - Notification type string ('reservation_reminder_5h' or 'reservation_reminder_30min')
 * @returns Summary: { processed, succeeded, failed }
 */
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

/**
 * Main job entry point: send reminders for both configured windows.
 *
 * Reads window configuration from platform settings (or env/defaults),
 * executes both windows in parallel, and returns aggregated results.
 *
 * @returns SendRemindersResult with processed/succeeded/failed counts per window
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

  const [reminders_5h, reminders_30min] = await Promise.all([
    sendRemindersForWindow(firstWindowMinutes, 'reservation_reminder_5h'),
    sendRemindersForWindow(secondWindowMinutes, 'reservation_reminder_30min'),
  ]);

  return { reminders_5h, reminders_30min };
}
