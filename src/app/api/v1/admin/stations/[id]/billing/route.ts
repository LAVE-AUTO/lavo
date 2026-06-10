/**
 * GET /api/v1/admin/stations/:id/billing - station billing model (commission | subscription). Admin only.
 * PUT /api/v1/admin/stations/:id/billing - set the station billing model. Admin only.
 *
 * PUT body: { model: 'commission' } | { model: 'subscription', plan_id: uuid }
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError, ValidationError } from '@/lib/errors';
import { getStationBillingModel, setStationBillingModel } from '@/server/admin/subscription-service';
import { getSubscriptionDecisionState } from '@/server/station/station-subscription-service';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const bodySchema = z.discriminatedUnion('model', [
  z.object({ model: z.literal('commission') }),
  z.object({ model: z.literal('subscription'), plan_id: z.string().min(1) }),
]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return applyNoStoreHeaders(error400('Invalid station id', ApiCode.VALIDATION_FAILED));
  }
  try {
    const [billing, decision_state] = await Promise.all([
      getStationBillingModel(id),
      getSubscriptionDecisionState(id),
    ]);
    return applyNoStoreHeaders(successResponse({ ...billing, decision_state }));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return applyNoStoreHeaders(error400('Invalid station id', ApiCode.VALIDATION_FAILED));
  }

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const billing = await setStationBillingModel(id, parsed.data, auth.sub);
    return applyNoStoreHeaders(successResponse(billing, 'Station billing model updated'));
  } catch (e) {
    if (e instanceof ValidationError) return applyNoStoreHeaders(error400(e.message, ApiCode.VALIDATION_FAILED));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
