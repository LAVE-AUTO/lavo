import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error409, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import { HTTP_STATUS } from '@/helpers/constants';
import { createTipSchema, reservationIdParamSchema, mapZodErrors } from '@/validators/tip';
import { createTip } from '@/server/tips/tip-service';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/reservations/:id/tip
 * Sends a tip (pourboire) for a completed reservation.
 * The full tip amount is transferred to the station via Stripe - no platform commission.
 * Returns a Stripe client_secret for the frontend to confirm payment with the client's card.
 *
 * Role: client only.
 *
 * Responses:
 *   201 { data: { tip, clientSecret } }
 *   400 VALIDATION_FAILED  - invalid UUID param or body
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN          - reservation does not belong to authenticated client
 *   404 NOT_FOUND          - reservation or station not found
 *   409 TIP_ALREADY_EXISTS - a tip has already been sent for this reservation
 *   422 UNPROCESSABLE_ENTITY - reservation not completed, or station not payment-ready
 *   500 INTERNAL_ERROR
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const idResult = reservationIdParamSchema.safeParse(id);
  if (!idResult.success) {
    return applyNoStoreHeaders(error400('Invalid reservation ID format', ApiCode.VALIDATION_FAILED));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = createTipSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error)));
  }

  try {
    const result = await createTip(auth.sub, idResult.data, parsed.data);
    return successResponse(result, 'Tip sent successfully', 201);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === HTTP_STATUS.CONFLICT) {
      return applyNoStoreHeaders(error409(e.message, ApiCode.TIP_ALREADY_EXISTS));
    }
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
