/**
 * POST /api/v1/station/subscription/checkout - start a Stripe Checkout (mode
 * subscription) for the station's assigned plan. Returns the Checkout URL.
 * Auth: station.
 *
 * Body: { interval: 'month' | 'year', locale?: string }
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationByUserId } from '@/server/station/station-repository';
import { createSubscriptionCheckout } from '@/server/station/station-subscription-service';
import { AppError, ValidationError } from '@/lib/errors';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const bodySchema = z.object({
  interval: z.enum(['month', 'year']),
  locale: z.string().max(5).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const { url } = await createSubscriptionCheckout(station.id, parsed.data.interval, parsed.data.locale ?? 'fr');
    return applyNoStoreHeaders(successResponse({ url }));
  } catch (e) {
    if (e instanceof ValidationError) return applyNoStoreHeaders(error400(e.message, ApiCode.VALIDATION_FAILED));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
