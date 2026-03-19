/**
 * GET /api/cron/downgrade-late-reservations
 * Cron endpoint: moves late unconfirmed reservations to queue (US-12).
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET> to match CRON_SECRET env var.
 */
import { headers } from 'next/headers';
import { verifyCronSecret } from '@/lib/verify-cron-secret';
import { runDowngradeLateReservations } from '@/jobs/downgrade-late-reservations';
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
    const result = await runDowngradeLateReservations();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}
