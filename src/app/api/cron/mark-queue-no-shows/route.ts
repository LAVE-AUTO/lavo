/**
 * GET /api/cron/mark-queue-no-shows
 * Cron endpoint: cancels active queue entries past station closing time with a no-show fee.
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET> to match CRON_SECRET env var.
 * Should run once daily, after the latest expected station closing time.
 */
import { headers } from 'next/headers';
import { verifyCronSecret } from '@/lib/verify-cron-secret';
import { runMarkQueueNoShows } from '@/jobs/mark-queue-no-shows';
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
    const result = await runMarkQueueNoShows();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}
