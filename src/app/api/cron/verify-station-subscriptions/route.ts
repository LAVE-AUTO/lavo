/**
 * GET /api/cron/verify-station-subscriptions
 * Cron endpoint: subscription lifecycle for stations on subscription billing.
 *   1. J-7 expiry warning email to the station owner and all active admins.
 *   2. Auto-switch to commission when an admin decision window (suspend vs
 *      commission) exceeds its grace period without a decision.
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET>.
 *
 * Recommended schedule: hourly (the 10h grace window needs sub-day resolution).
 *
 * Responses:
 *   200 { data: { warnings: { processed, emailed }, auto_commission: { processed, switched } } }
 *   401 Missing or invalid cron secret
 *   500 INTERNAL_ERROR
 */
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';
import {
  runSubscriptionExpiryWarnings,
  runSubscriptionAutoCommission,
  SUBSCRIPTION_WARN_DAYS,
  SUBSCRIPTION_DECISION_GRACE_HOURS,
} from '@/server/station/station-subscription-service';

export async function GET() {
  if (!(await isAuthorizedCronRequest())) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const warnings = await runSubscriptionExpiryWarnings(SUBSCRIPTION_WARN_DAYS);
    const auto_commission = await runSubscriptionAutoCommission(SUBSCRIPTION_DECISION_GRACE_HOURS);
    return successResponse({ warnings, auto_commission }, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}
