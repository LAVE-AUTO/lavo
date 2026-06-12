/**
 * GET /api/v1/station/subscription - the station's subscription status (or null). Auth: station.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error404, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationByUserId } from '@/server/station/station-repository';
import { getStationSubscription, reconcileStationSubscription } from '@/server/station/station-subscription-service';
import { getStationBillingModel, getSubscriptionPlans } from '@/server/admin/subscription-service';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const [billing, initialSub, plans] = await Promise.all([
      getStationBillingModel(station.id),
      getStationSubscription(station.id),
      getSubscriptionPlans(),
    ]);

    /* Self-heal a stuck `incomplete` row: Checkout completed on Stripe's side
     * but the webhook may not have arrived (local dev / missing secret). Pull
     * the live state once so the dashboard banner clears without waiting. */
    let sub = initialSub;
    if (sub?.status === 'incomplete' && sub.stripe_customer_id) {
      try { sub = (await reconcileStationSubscription(station.id)) ?? sub; }
      catch (err) { console.error('[GET /station/subscription] reconcile failed', err); }
    }

    return applyNoStoreHeaders(
      successResponse({
        billing_model: billing.model,
        plan_id: billing.model === 'subscription' ? billing.plan_id : null,
        plans: plans.filter((p) => p.is_active),
        subscription: sub
          ? {
              status: sub.status,
              plan_name: sub.plan_name,
              interval: sub.interval,
              amount: Number(sub.amount),
              current_period_end: sub.current_period_end?.toISOString() ?? null,
            }
          : null,
      }),
    );
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
