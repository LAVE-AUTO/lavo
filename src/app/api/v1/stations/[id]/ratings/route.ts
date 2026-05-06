/**
 * GET /api/v1/stations/:id/ratings
 * Public list of visible ratings for a station, paginated. No auth required.
 *
 * Params: id (station UUID)
 * Query: page (default 1), limit (default 10, max 50)
 *
 * Responses:
 *   200 { data: { items: [{ id, score, comment, created_at }], meta: PaginationMeta } }
 *   400 VALIDATION_FAILED
 *   404 NOT_FOUND - station not found
 *   500 INTERNAL_ERROR
 */
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError } from '@/lib/errors';
import {
  stationRatingsQuerySchema,
  ratingStationIdParamSchema,
  mapZodErrors,
} from '@/validators/ratings';
import { getPublicRatings } from '@/server/ratings/rating-service';
import type { NextResponse } from 'next/server';


// %%%%% Endpoint handler %%%%%
// GET /api/v1/stations/:id/ratings

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Validate station id param
  const paramParsed = ratingStationIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return error400('Invalid station id', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }

  // Validate query params
  const { searchParams } = new URL(request.url);
  const queryParsed = stationRatingsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(queryParsed.error));
  }

  const { page, limit } = queryParsed.data;

  // Fetch public ratings
  try {
    const result = await getPublicRatings(paramParsed.data.id, page, limit);
    return successResponse(result);
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
