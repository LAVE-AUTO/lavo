import { requireRole } from '@/lib/require-role';
import { getPendingStations } from '@/server/station/station-service';
import { successResponse, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/stations
 * List all stations pending admin validation.
 * Requires admin role.
 *
 * Responses:
 *   200 { data: Station[] }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof Response) return auth as NextResponse;

  try {
    const stations = await getPendingStations();
    return successResponse(stations);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
