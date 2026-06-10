/**
 * GET /api/v1/station/billing - the station's own billing model. Auth: station.
 * PUT /api/v1/station/billing - the station sets its own billing model
 *   (commission vs subscription). Notifies admins of the change. Auth: station.
 *
 * PUT body: { model: 'commission' } | { model: 'subscription', plan_id: string }
 *
 * Note: switching to 'subscription' only records intent. The station must then
 * complete payment via POST /station/subscription/checkout; commission is only
 * waived once the subscription is actually active.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError, ValidationError } from '@/lib/errors';
import { findStationByUserId } from '@/server/station/station-repository';
import { getStationBillingModel, setStationBillingModel } from '@/server/admin/subscription-service';
import { notifyAdminEvent } from '@/server/notifications/admin-notification-service';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const bodySchema = z.discriminatedUnion('model', [
  z.object({ model: z.literal('commission') }),
  z.object({ model: z.literal('subscription'), plan_id: z.string().min(1) }),
]);

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const billing = await getStationBillingModel(station.id);
    return applyNoStoreHeaders(successResponse(billing));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const previous = await getStationBillingModel(station.id);
    // Station-initiated change: no admin actor (updated_by stays null).
    const billing = await setStationBillingModel(station.id, parsed.data, null);

    // Keep admins in the loop, but only when the model actually changed.
    if (previous.model !== billing.model) {
      await notifyAdminEvent({
        type: 'station_billing_changed',
        stationId: station.id,
        actorUserId: auth.sub,
        payload: { station_name: station.name, from: previous.model, to: billing.model },
      }).catch(() => { /* notification failure must not fail the change */ });
    }

    return applyNoStoreHeaders(successResponse(billing, 'Billing model updated'));
  } catch (e) {
    if (e instanceof ValidationError) return applyNoStoreHeaders(error400(e.message, ApiCode.VALIDATION_FAILED));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
