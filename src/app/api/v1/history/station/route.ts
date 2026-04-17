/**
 * GET /api/v1/history/station
 * Returns paginated activity history for the authenticated station.
 * Auth: station role only. Scoped to the authenticated station's data.
 *
 * Query params:
 *   page         - integer 1–10000 (default 1)
 *   limit        - integer 1–100 (default 20)
 *   from         - YYYY-MM-DD start date (inclusive)
 *   to           - YYYY-MM-DD end date (inclusive)
 *   status       - reservation status filter
 *   amount_min   - minimum amount_paid filter (numeric)
 *   amount_max   - maximum amount_paid filter (numeric)
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { stationHistoryQuerySchema, mapZodErrors } from '@/validators/history';
import { findStationByUserId } from '@/server/station/station-repository';
import { getStationHistory } from '@/server/history/station-history-service';
import { AppError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  const { searchParams } = new URL(request.url);
  const raw = {
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    amount_min: searchParams.get('amount_min') ?? undefined,
    amount_max: searchParams.get('amount_max') ?? undefined,
  };

  const parsed = stationHistoryQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const result = await getStationHistory({ stationId: station.id, ...parsed.data });
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
