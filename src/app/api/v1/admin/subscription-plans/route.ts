/**
 * GET  /api/v1/admin/subscription-plans  - list station subscription plans. Admin only.
 * PUT  /api/v1/admin/subscription-plans  - replace the plan list. Admin only.
 *
 * PUT body: { plans: Array<{ id?, name, monthly_price, annual_price?, is_active }> }
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError, ValidationError } from '@/lib/errors';
import { getSubscriptionPlans, setSubscriptionPlans } from '@/server/admin/subscription-service';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  monthly_price: z.number().min(0).max(1_000_000),
  annual_price: z.number().min(0).max(1_000_000).nullable().optional(),
  is_active: z.boolean(),
});

const bodySchema = z.object({ plans: z.array(planSchema).max(20) });

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);
  try {
    const plans = await getSubscriptionPlans();
    return applyNoStoreHeaders(successResponse(plans));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const plans = await setSubscriptionPlans(parsed.data.plans, auth.sub);
    return applyNoStoreHeaders(successResponse(plans, 'Subscription plans updated'));
  } catch (e) {
    if (e instanceof ValidationError) return applyNoStoreHeaders(error400(e.message, ApiCode.VALIDATION_FAILED));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
