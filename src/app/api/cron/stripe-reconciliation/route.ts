/**
 * GET /api/cron/stripe-reconciliation
 *
 * Reconciles Stripe state with our DB for two failure markers introduced in migration 0051:
 *   - reservations.pi_cancel_failed_at  (bug #12) — retry cancelPaymentIntent
 *   - reservations.refund_persist_failed_at (bug #26) — recover stripe_refund_id from Stripe
 *
 * Recommended schedule: every 15 minutes (frequent enough that a transient Stripe outage
 * resolves quickly without backlogging client refunds, infrequent enough to avoid pinging
 * Stripe for nothing — the partial indexes keep DB scans cheap when both columns are NULL).
 *
 * Idempotent: each pass operates on guarded UPDATEs (clear* helpers only clear what they
 * own). Re-running mid-batch is safe.
 */
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';
import { runStripeReconciliation } from '@/server/payments/stripe-reconciliation-service';

export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runStripeReconciliation();
    if (result.pi_cancel.errors > 0 || result.refund_persist.errors > 0) {
      console.error('[CRON stripe-reconciliation] Completed with errors', result);
    } else {
      console.log('[CRON stripe-reconciliation] Completed', result);
    }
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    console.error('[CRON stripe-reconciliation] Unhandled error:', e);
    return error500(e);
  }
}
