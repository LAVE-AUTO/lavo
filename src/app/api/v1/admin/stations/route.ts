import { requireRole } from '@/lib/require-role';
import { getPendingStations } from '@/server/station/station-service';
import { successResponse, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/stations
 * List all stations pending admin validation.
 * Requires DB role `'admin'` (UI "SUPER_ADMIN" is display-only; see docs/ARCHITECTURE.md).
 *
 * Responses:
 *   200 { data: Station[] }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET() {
  const auth = await requireRole(undefined, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const stations = await getPendingStations();
    return applyNoStoreHeaders(successResponse(stations));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
