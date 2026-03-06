import type { NextResponse } from 'next/server';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError } from '@/lib/errors';
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import { getStationJoinPublic } from '@/server/station/station-service';

/**
 * POST /api/v1/stations/:id/join
 * "Client en route": returns a Google Maps URL for the station (lat/lng or address).
 * Returns 404 if station does not exist or is not active.
 *
 * Responses: 200 { data: { mapsUrl: string } }, 400 VALIDATION_FAILED, 404 NOT_FOUND, 500 INTERNAL_ERROR.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const parsed = stationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }
  try {
    const { mapsUrl } = await getStationJoinPublic(parsed.data.id);
    return successResponse({ mapsUrl });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
