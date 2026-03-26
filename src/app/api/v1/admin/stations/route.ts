import { requireRole } from '@/lib/require-role';
import { getPendingStations } from '@/server/station/station-service';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import { listPendingStationsQuerySchema, mapZodErrors } from '@/validators/station';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/stations
 * List all stations pending admin validation — paginated.
 * Requires DB role `'admin'` (UI "SUPER_ADMIN" is display-only; see docs/ARCHITECTURE.md).
 *
 * Query: page (default 1), per_page (default 20, max 100)
 *
 * Responses:
 *   200 { data: { stations: Station[], meta: { total, page, per_page, total_pages } } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { searchParams } = new URL(request.url);
  const parsed = listPendingStationsQuerySchema.safeParse({
    // L-1: Use || instead of ?? so empty string "" becomes undefined (avoids NaN from z.coerce.number()).
    page: searchParams.get('page') || undefined,
    per_page: searchParams.get('per_page') || undefined,
  });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const result = await getPendingStations(parsed.data.page, parsed.data.per_page);
    return successResponse({ stations: result.stations, meta: result.meta });
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
