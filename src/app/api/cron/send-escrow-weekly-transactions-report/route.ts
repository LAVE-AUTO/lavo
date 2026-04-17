/**
 * GET /api/cron/send-escrow-weekly-transactions-report
 * Cron endpoint: sends weekly escrow transactions report email.
 *
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET>.
 */
import { headers } from 'next/headers';
import { verifyCronSecret } from '@/lib/verify-cron-secret';
import { runSendEscrowWeeklyTransactionsReport } from '@/jobs/send-escrow-weekly-transactions-report';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';

export async function GET() {
  const headersList = await headers();
  const auth = headersList.get('authorization');
  const bearerToken = auth?.match(/^Bearer\s*(.*)$/i)?.[1]?.trim() ?? '';
  const secret = headersList.get('x-cron-secret') ?? bearerToken;
  const expected = process.env.CRON_SECRET ?? '';

  if (!verifyCronSecret(secret, expected)) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runSendEscrowWeeklyTransactionsReport();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}

