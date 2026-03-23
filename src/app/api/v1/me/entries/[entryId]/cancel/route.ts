/**
 * PATCH /api/v1/me/entries/:entryId/cancel
 * Unified cancellation endpoint for all entry types. Auth: client.
 *
 * Behaviour by entry type:
 * - Confirmed reservation (paid): applies cancellation policy (free window / late penalty),
 *   issues Stripe refund, and returns financial details in the response.
 * - Pending payment reservation: cancels the Stripe PaymentIntent, no charge to the client.
 * - Queue entry: removes from queue, shifts positions, no Stripe interaction.
 *
 * Body (optional): { reason?: string } — forwarded as cancellation_reason for reservations.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { entryIdParamSchema, cancelEntryBodySchema, mapZodErrors } from '@/validators/entry';
import { cancelEntry } from '@/server/reservations/reservation-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ entryId: string }> };

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

  const { entryId } = await params;
  const paramParsed = entryIdParamSchema.safeParse({ entryId });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }

  let reason: string | undefined;
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
    }
    const bodyParsed = cancelEntryBodySchema.safeParse(body);
    if (!bodyParsed.success) {
      return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
    }
    reason = bodyParsed.data?.reason;
  }

  try {
    const result = await cancelEntry(paramParsed.data.entryId, auth.sub, reason);
    return successResponse({
      ...serializeEntry(result.entry),
      ...(result.refundedAmount !== undefined && {
        refunded_amount: result.refundedAmount,
        penalty_amount: result.penaltyAmount,
        is_late_cancellation: result.isLateCancellation,
      }),
    });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
