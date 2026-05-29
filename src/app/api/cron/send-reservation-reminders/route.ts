/**
 * GET /api/cron/send-reservation-reminders
 * Cron endpoint: sends push reminders for reservations 5h and 30min before service start.
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET>.
 *
 * Recommended schedule: every 10 minutes (covers the 14-minute tolerance window).
 *
 * Responses:
 *   200 { data: { reminders_5h: { processed, succeeded, failed }, reminders_30min: { ... } } }
 *   401 Missing or invalid cron secret
 *   500 INTERNAL_ERROR
 */
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runSendReservationReminders } from '@/jobs/send-reservation-reminders';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';

/**
 * NOT idempotent at the push side: the 5h/30min windows are time-bucketed but a re-run
 * within the same tolerance window can resend a reminder. Schedule once per tolerance
 * window (e.g. every 10 minutes for a 14-min window).
 */
export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runSendReservationReminders();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}
