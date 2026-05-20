import { headers } from 'next/headers';
import { verifyCronSecret } from '@/lib/verify-cron-secret';
import { runPurgeAdminLogs } from '@/jobs/purge-admin-logs';
import { successResponse, error401, error500 } from '@/lib/responses';

/**
 * GET /api/cron/purge-admin-logs
 * Deletes admin activity logs older than the configured retention window.
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET>.
 *
 * Recommended schedule: nightly at 3am (0 3 * * *)
 *
 * Responses:
 *   200 { data: { deleted, retention_days, cutoff } }
 *   401 Missing or invalid cron secret
 *   500 INTERNAL_ERROR
 */
export async function GET() {
  const headersList = await headers();
  const auth = headersList.get('authorization');
  const bearerToken = auth?.match(/^Bearer\s*(.*)$/i)?.[1]?.trim() ?? '';
  const secret = headersList.get('x-cron-secret') ?? bearerToken;

  if (!verifyCronSecret(secret, process.env.CRON_SECRET ?? '')) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runPurgeAdminLogs();
    return successResponse(result);
  } catch (e) {
    console.error('[GET /api/cron/purge-admin-logs] Unhandled error:', e);
    return error500(e);
  }
}
