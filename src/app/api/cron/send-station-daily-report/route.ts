/**
 * GET /api/cron/send-station-daily-report
 * Cron endpoint: emails the previous day's activity report to stations that
 * opted in (notification_prefs.daily_report === true).
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET>.
 *
 * Recommended schedule: daily, early morning (e.g. 0 6 * * *).
 *
 * Responses:
 *   200 { data: { processed, sent, skipped, failed } }
 *   401 Missing or invalid cron secret
 *   500 INTERNAL_ERROR
 */
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runSendStationDailyReport } from '@/jobs/send-station-daily-report';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';

export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runSendStationDailyReport();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}
