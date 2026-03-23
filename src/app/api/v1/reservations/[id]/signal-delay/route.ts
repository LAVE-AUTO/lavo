/**
 * POST /api/v1/reservations/:id/signal-delay
 * Client signals they will be late for their reservation. Auth: client.
 * Creates a delay request (status=pending) and notifies the station.
 *
 * Body: { message?: string }  (optional)
 * Response 201: { data: { delay_request } }
 * Errors: 400 VALIDATION_FAILED, 401 UNAUTHORIZED, 404 NOT_FOUND, 409 CONFLICT, 500 INTERNAL_ERROR
 */
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/require-role';
import { error400, error404, error409, error500, fromAppError, successResponse } from '@/lib/responses';
import { signalDelay } from '@/server/reservations/delay-service';
import { ApiCode } from '@/types/api-codes';
import { HTTP_STATUS } from '@/helpers/constants';
import { mapZodErrors, reservationIdParamSchema, signalDelayBodySchema } from '@/validators/entry';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const paramParsed = reservationIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    // body is optional
  }

  const bodyParsed = signalDelayBodySchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
  }

  try {
    const delayRequest = await signalDelay(
      paramParsed.data.id,
      auth.sub,
      bodyParsed.data?.message
    );
    return successResponse({ delay_request: delayRequest }, undefined, HTTP_STATUS.CREATED);
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
