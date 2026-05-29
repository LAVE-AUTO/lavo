/**
 * GET /api/cron/send-escrow-weekly-transactions-report
 * Cron endpoint: sends weekly escrow transactions report email.
 *
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET>.
 */
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runSendEscrowWeeklyTransactionsReport } from '@/jobs/send-escrow-weekly-transactions-report';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';

/**
 * NOT idempotent at the email side: a manual re-run within the same week will resend the
 * report to recipients. Schedule strictly once per period (weekly).
 */
export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runSendEscrowWeeklyTransactionsReport();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}

