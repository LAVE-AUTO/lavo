import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runPurgeAdminLogs } from '@/jobs/purge-admin-logs';
import { successResponse, error401, error500 } from '@/lib/responses';

/**
 * GET /api/cron/purge-admin-logs
 * Deletes admin activity logs older than the configured retention window.
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET>.
 *
 * Recommended schedule: nightly at 3am (0 3 * * *)
 *
 * Idempotent: DELETE WHERE created_at < cutoff. Re-running on the same day deletes nothing
 * new — only newly-expired rows beyond the retention horizon are affected.
 *
 * Responses:
 *   200 { data: { deleted, retention_days, cutoff } }
 *   401 Missing or invalid cron secret
 *   500 INTERNAL_ERROR
 */
export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
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
