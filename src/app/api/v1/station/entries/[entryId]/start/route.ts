/**
 * POST /api/v1/station/entries/:entryId/start
 * Starts a service after the station has verified the 6-character ticket code
 * presented by the client. Auth: station.
 *
 * Body: { code: string } - 6 alphanumeric characters (case-insensitive).
 *
 * Responses:
 *   200 { data: Entry } - status transitioned to in_progress
 *   400 INVALID_TICKET_CODE - the code does not match the entry
 *   400 VALIDATION_FAILED  - missing or malformed body / param
 *   404 NOT_FOUND          - entry does not belong to this station
 *   409 CONFLICT           - entry status cannot move to in_progress
 *   500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { entryIdParamSchema, stationStartEntryBodySchema, mapZodErrors } from '@/validators/entry';
import { findStationByUserId } from '@/server/station/station-repository';
import { startEntryByStation } from '@/server/reservations/reservation-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, NotFoundError, InvalidTicketCodeError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ entryId: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
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
  const bodyParsed = stationStartEntryBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error))
    );
  }

  try {
    const entry = await startEntryByStation(
      paramParsed.data.entryId,
      station.id,
      bodyParsed.data.code
    );
    return applyNoStoreHeaders(successResponse(serializeEntry(entry)));
  } catch (e) {
    if (e instanceof InvalidTicketCodeError) {
      return applyNoStoreHeaders(error400(e.message, ApiCode.VALIDATION_FAILED));
    }
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
