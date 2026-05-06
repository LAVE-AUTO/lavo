/**
 * POST /api/v1/reservations/:id/refuse-delay
 * Station refuses a pending delay request from a client. Auth: station.
 * Updates delay request status to 'refused' and notifies the client.
 * The reservation status is NOT modified - the cron remains sole arbiter of late detection.
 *
 * Response 200: { data: { delay_request } }
 * Errors: 400 VALIDATION_FAILED, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 500 INTERNAL_ERROR
 */
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/require-role';
import { error400, error404, error409, error500, fromAppError, successResponse } from '@/lib/responses';
import { refuseDelay } from '@/server/reservations/delay-service';
import { findStationByUserId } from '@/server/station/station-repository';
import { ApiCode } from '@/types/api-codes';
import { mapZodErrors, refuseDelayBodySchema, reservationIdParamSchema } from '@/validators/entry';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  const { id } = await params;
  const paramParsed = reservationIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const bodyParsed = refuseDelayBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
  }

  try {
    const delayRequest = await refuseDelay(paramParsed.data.id, station.id, bodyParsed.data?.refusal_reason);
    return successResponse({ delay_request: delayRequest });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
