/**
 * GET /api/cron/cleanup-orphaned-payments
 * Cron endpoint: cancels queue entries stuck in 'pending_payment' with no stripe_payment_id.
 * These entries are created by the walk-in flow before calling Stripe; if the server crashes
 * between the DB insert and the PaymentIntent creation the entry is never resolved by a webhook.
 * Requires Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 * Reads ORPHAN_PAYMENT_TIMEOUT_MINUTES from env (default: 15).
 */
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';
import { cleanupOrphanedPaymentEntries } from '@/server/reservations/orphan-cleanup-service';


// %%%%% Constants %%%%%
// Timeout configuration

const DEFAULT_TIMEOUT_MINUTES = 15;


// %%%%% GET Handler %%%%%
// Cleanup orphaned payment entries
//
// Idempotent: cancelOrphanedEntryIfEligible is a guarded UPDATE with status='pending_payment'
// AND stripe_payment_id IS NULL — re-running this cron never double-cancels.

export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  const rawTimeout = process.env.ORPHAN_PAYMENT_TIMEOUT_MINUTES;
  const timeoutMinutes = rawTimeout ? parseInt(rawTimeout, 10) : DEFAULT_TIMEOUT_MINUTES;
  const resolvedTimeout = Number.isFinite(timeoutMinutes) && timeoutMinutes > 0
    ? timeoutMinutes
    : DEFAULT_TIMEOUT_MINUTES;

  try {
    const result = await cleanupOrphanedPaymentEntries(resolvedTimeout);
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    console.error('[CRON cleanup-orphaned-payments] Unhandled error:', e);
    return error500();
  }
}
