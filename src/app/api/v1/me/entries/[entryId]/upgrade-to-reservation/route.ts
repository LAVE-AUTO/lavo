/**
 * POST /api/v1/me/entries/:entryId/upgrade-to-reservation
 * Upgrade a queue entry to a reservation (assign time slot). Auth: user. Body: time_slot_id.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { entryIdParamSchema, upgradeToReservationBodySchema, mapZodErrors } from '@/validators/entry';
import { upgradeQueueToReservation } from '@/server/reservations/reservation-service';
import { findEntryByIdAndUser } from '@/server/reservations/entry-repository';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ entryId: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole('user');
  if (auth instanceof Response) return auth as NextResponse;

  const { entryId } = await params;
  const paramParsed = entryIdParamSchema.safeParse({ entryId });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }
  const bodyParsed = upgradeToReservationBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
  }

  const entry = await findEntryByIdAndUser(paramParsed.data.entryId, auth.sub);
  if (!entry) return error404('Entry not found');

  try {
    const updated = await upgradeQueueToReservation(
      paramParsed.data.entryId,
      auth.sub,
      bodyParsed.data.time_slot_id,
      entry.station_id
    );
    return successResponse(serializeEntry(updated));
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

