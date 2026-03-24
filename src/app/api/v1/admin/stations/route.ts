import { requireRole } from '@/lib/require-role';
import { getPendingStations, getStationsForAdmin } from '@/server/station/station-service';
import { successResponse, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
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
 * Responses:
 *   200 { data: Station[] }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET(request: Request) {
  const auth = await requireRole(undefined, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    let stations;
    if (!statusParam) {
      // Legacy: no param → pending only
      stations = await getPendingStations();
    } else if (statusParam === 'all') {
      stations = await getStationsForAdmin();
    } else if (ALLOWED_STATUSES.includes(statusParam as AllowedStatus)) {
      stations = await getStationsForAdmin(statusParam);
    } else {
      stations = await getPendingStations();
    }

    return successResponse(stations);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
