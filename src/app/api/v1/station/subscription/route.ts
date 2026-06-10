/**
 * GET /api/v1/station/subscription - the station's subscription status (or null). Auth: station.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error404, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationByUserId } from '@/server/station/station-repository';
import { getStationSubscription } from '@/server/station/station-subscription-service';
import { getStationBillingModel } from '@/server/admin/subscription-service';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const [billing, sub] = await Promise.all([
      getStationBillingModel(station.id),
      getStationSubscription(station.id),
    ]);
    return applyNoStoreHeaders(
      successResponse({
        billing_model: billing.model,
        plan_id: billing.model === 'subscription' ? billing.plan_id : null,
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
