import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runSyncPendingUploads } from '@/jobs/sync-pending-uploads';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';

/**
 * GET /api/cron/sync-pending-uploads
 * Cron endpoint: processes up to 100 pending_uploads (local files to Cloudinary).
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET> to match CRON_SECRET env var.
 *
 * Idempotent: pending_uploads rows are deleted on success — re-runs only pick up rows still
 * marked pending. A row whose Cloudinary upload succeeded but whose deletion failed would be
 * re-uploaded once, producing a duplicate Cloudinary asset; acceptable for a recovery cron.
 *
 * Responses:
 *   200 { data: { processed, succeeded, failed } }
 *   401 Missing or invalid cron secret
 *   500 INTERNAL_ERROR
 */
export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runSyncPendingUploads();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}
