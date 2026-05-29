/**
 * GET /api/cron/recover-stalled-payments
 *
 * Polls Stripe for reservations stuck in `pending_payment` with a PaymentIntent
 * that was created but whose `amount_capturable_updated` webhook never arrived
 * (Stripe outage, misconfigured endpoint URL, missing STRIPE_WEBHOOK_SECRET).
 *
 * Recommended schedule: every 10 minutes.
 * Env var: STALLED_PAYMENT_TIMEOUT_MINUTES (default: 10) — entries must be at
 * least this many minutes old before they are considered stalled.
 *
 * Authentication: Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 */
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';
import { recoverStalledPayments } from '@/server/reservations/stalled-payment-recovery-service';

const DEFAULT_STALE_MINUTES = 10;

/**
 * Idempotent: confirmEntryIfPendingPayment and cancelEntryForStripePaymentFailureIfEligible
 * are status-guarded UPDATEs; concurrent webhook + cron handling produces no double effects.
 */
export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  const rawTimeout = process.env.STALLED_PAYMENT_TIMEOUT_MINUTES;
  const staleMinutes = rawTimeout ? parseInt(rawTimeout, 10) : DEFAULT_STALE_MINUTES;
  const resolvedMinutes =
    Number.isFinite(staleMinutes) && staleMinutes > 0 ? staleMinutes : DEFAULT_STALE_MINUTES;

  try {
    const result = await recoverStalledPayments(resolvedMinutes);
    if (result.errors.length > 0) {
      console.error('[CRON recover-stalled-payments] Completed with errors', result);
    } else {
      console.log('[CRON recover-stalled-payments] Completed', result);
    }
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    console.error('[CRON recover-stalled-payments] Unhandled error:', e);
    return error500();
  }
}
