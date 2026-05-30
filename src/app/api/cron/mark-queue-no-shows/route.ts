/**
 * GET /api/cron/mark-queue-no-shows
 * Cron endpoint: cancels active queue entries past station closing time with a no-show fee.
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET> to match CRON_SECRET env var.
 * Should run once daily, after the latest expected station closing time.
 */
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runMarkQueueNoShows } from '@/jobs/mark-queue-no-shows';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';

/**
 * Idempotent: cancelQueueEntryForNoShowIfEligible is a guarded UPDATE; Stripe operations
 * use entry-scoped idempotency keys. Re-running this cron is safe.
 */
export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runMarkQueueNoShows();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}
