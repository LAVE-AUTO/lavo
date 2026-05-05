/**
 * PATCH /api/v1/station/entries/:entryId/priority
 * Repositions a queue entry to a new position. Auth: station.
 *
 * Body: { position: 'front' | number }
 *
 * Responses:
 *   200 { data: Entry }
 *   400 VALIDATION_FAILED
 *   404 NOT_FOUND
 *   409 CONFLICT — entry is not an active queue entry
 *   500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { setPriorityForEntry } from '@/server/reservations/reservation-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const paramSchema = z.object({ entryId: z.string().uuid('Invalid entryId') });

// Upper bound on `position` is defense-in-depth: an unbounded value would let a station
// trigger a wide-range UPDATE on its own queue. 10000 is far above any realistic queue
// length and keeps the SQL shift bounded.
const bodySchema = z.object({
  position: z.union([z.literal('front'), z.number().int().min(1).max(10000)]),
});

type Params = { params: Promise<{ entryId: string }> };

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { entryId } = await params;
  const paramParsed = paramSchema.safeParse({ entryId });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(error400('Invalid entry id', ApiCode.VALIDATION_FAILED));
  }

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));
  }

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const entry = await setPriorityForEntry(paramParsed.data.entryId, station.id, parsed.data.position);
    return applyNoStoreHeaders(successResponse(serializeEntry(entry)));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ConflictError) return applyNoStoreHeaders(error409(e.message, ApiCode.CONFLICT));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
