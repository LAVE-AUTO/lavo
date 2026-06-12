/**
 * POST /api/v1/admin/stations/:id/subscription/decision - resolve a station's
 * ended subscription. Admin only.
 *
 * Body: { decision: 'suspend' | 'commission' }
 *   - 'commission': switch the station to commission billing.
 *   - 'suspend':    suspend the station until it re-subscribes.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyAdminSubscriptionDecision } from '@/server/station/station-subscription-service';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const bodySchema = z.object({ decision: z.enum(['suspend', 'commission']) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
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
    await applyAdminSubscriptionDecision(id, parsed.data.decision, auth.sub);
    return applyNoStoreHeaders(successResponse({ decision: parsed.data.decision }, 'Decision applied'));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
