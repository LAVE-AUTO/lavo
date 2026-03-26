import { requireRole } from '@/lib/require-role';
import { getPendingStations, getStationsForAdmin } from '@/server/station/station-service';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import { listPendingStationsQuerySchema, mapZodErrors } from '@/validators/station';
import type { NextResponse } from 'next/server';

const ALLOWED_STATUSES = ['pending_admin_validation', 'active', 'rejected', 'suspended'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

/**
 * GET /api/v1/admin/stations
 * List stations for admin KYC management.
 *
 * Query params:
 *   ?status=pending_admin_validation|active|rejected|suspended  → filter by status
 *   ?status=all                                                 → return all stations
 *   (no param)                                                  → pending only (legacy)
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
    const statusParam = searchParams.get('status');

    let stations;
    if (!statusParam) {
      stations = await getPendingStations(parsed.data.page, parsed.data.per_page);
    } else if (statusParam === 'all') {
      stations = await getStationsForAdmin();
    } else if (ALLOWED_STATUSES.includes(statusParam as AllowedStatus)) {
      stations = await getStationsForAdmin(statusParam);
    } else {
      stations = await getPendingStations(parsed.data.page, parsed.data.per_page);
    }

    return successResponse(stations);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
