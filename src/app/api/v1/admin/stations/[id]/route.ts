import { requireRole } from '@/lib/require-role';
import { getStationById } from '@/server/station/station-service';
import { successResponse, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/stations/:id
 * Get full station details including submitted documents.
 * Requires admin role.
 *
 * Responses:
 *   200 { data: StationWithDocuments }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;

  try {
    const station = await getStationById(id);
    return successResponse(station);
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
