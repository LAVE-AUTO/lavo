/**
 * PATCH /api/v1/station/entries/:entryId
 * Update entry status (in_progress, completed, cancelled). Auth: station.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { entryIdParamSchema, stationPatchEntryBodySchema, mapZodErrors } from '@/validators/entry';
import { findStationByUserId } from '@/server/station/station-repository';
import { setEntryStatusByStation } from '@/server/reservations/reservation-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ entryId: string }> };

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  const { entryId } = await params;
  const paramParsed = entryIdParamSchema.safeParse({ entryId });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error))
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }
  const bodyParsed = stationPatchEntryBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error))
    );
  }

  try {
    const entry = await setEntryStatusByStation(
      paramParsed.data.entryId,
      station.id,
      bodyParsed.data.status
    );
    return applyNoStoreHeaders(successResponse(serializeEntry(entry)));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

