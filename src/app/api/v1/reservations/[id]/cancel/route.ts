/**
 * POST /api/v1/reservations/:id/cancel
 * Cancel a confirmed or pending reservation. Auth: client.
 * Applies a late cancellation penalty if within the platform-configured free window.
 * Issues a Stripe refund (full or partial) for the amount paid.
 *
 * Body (optional): { reason?: string }
 *
 * Response 200: { data: { entry, refunded_amount, penalty_amount, is_late_cancellation } }
 * Errors: 400 VALIDATION_FAILED, 404 NOT_FOUND, 409 CONFLICT, 500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import {
  successResponse,
  error400,
  error404,
  error409,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { reservationIdParamSchema, cancelReservationBodySchema, mapZodErrors } from '@/validators/entry';
import { cancelReservation } from '@/server/reservations/cancellation-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole('client');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const paramParsed = reservationIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is valid — no reason provided
  }

  const bodyParsed = cancelReservationBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
  }

  try {
    const { entry, refundedAmount, penaltyAmount, isLateCancellation } = await cancelReservation(
      paramParsed.data.id,
      auth.sub,
      bodyParsed.data.reason
    );

    return successResponse({
      entry: serializeEntry(entry),
      refunded_amount: refundedAmount,
      penalty_amount: penaltyAmount,
      is_late_cancellation: isLateCancellation,
    });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
