/**
 * GET /api/cron/downgrade-late-reservations
 * Cron endpoint: moves late unconfirmed reservations to queue (US-12).
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET> to match CRON_SECRET env var.
 */
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runDowngradeLateReservations } from '@/jobs/downgrade-late-reservations';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';

/**
 * Idempotent: listLateUnconfirmedReservations only returns reservations still in
 * 'confirmed' status with client_confirmed=false. moveReservationToQueue updates the row
 * atomically, so a re-run finds nothing new for already-processed entries.
 */
export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runDowngradeLateReservations();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}
