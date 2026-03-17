/**
 * GET /api/v1/station/entries
 * List all entries (reservations then queue) for the authenticated station with pagination. Auth: station.
 *
 * Query params: status, from (ISO date), to (ISO date), page, per_page
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { listEntriesQuerySchema, mapZodErrors } from '@/validators/entry';
import { findStationByUserId } from '@/server/station/station-repository';
import { listStationEntries } from '@/server/reservations/reservation-service';
import { serializeStationEntry } from '@/server/reservations/entry-serializer';
import { AppError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole('station');
  if (auth instanceof Response) return auth as NextResponse;

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  const { searchParams } = new URL(request.url);
  const queryParsed = listEntriesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(queryParsed.error));
  }

  const { status, from, to, page, per_page } = queryParsed.data;

  try {
    const result = await listStationEntries(station.id, {
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page,
      per_page,
    });
    return successResponse({
      entries: result.rows.map(serializeStationEntry),
      total: result.total,
      page: result.page,
      per_page: result.per_page,
    });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
