/**
 * GET /api/cron/send-kyc-expiry-reminders
 * Cron endpoint: sends KYC document expiry reminders to station owners and active admins.
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET>.
 *
 * Recommended schedule: daily at 8am (configure via KYC_REMINDER_CRON_SCHEDULE env var,
 * default: 0 8 * * *).
 *
 * Responses:
 *   200 { data: { first_reminder: { processed, succeeded, failed }, second_reminder: { ... } } }
 *   401 Missing or invalid cron secret
 *   500 INTERNAL_ERROR
 */
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runSendKycExpiryReminders } from '@/jobs/send-kyc-expiry-reminders';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';


// %%%%% Route handler %%%%%
// Auth check, job dispatch, and response shaping
//
// NOT idempotent: re-running the cron the same day resends reminders. Caller responsible
// for scheduling a single daily invocation. The job-side reminder_sent_at flag would make
// it idempotent but is not yet implemented.

export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runSendKycExpiryReminders();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}


// %%%%% END - Route handler %%%%%
