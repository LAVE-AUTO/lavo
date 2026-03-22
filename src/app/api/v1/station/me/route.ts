import { requireRole } from '@/lib/require-role';
import { getMyStation } from '@/server/station/station-service';
import { successResponse, error403, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/station/me
 * Return the authenticated station's profile including submitted documents.
 * Requires an active station account (approved by admin).
 *
 * Responses:
 *   200 { data: StationWithDocuments }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN — not a station or not yet approved
 *   404 NOT_FOUND — no station associated with this account
 *   500 INTERNAL_ERROR
 */
export async function GET() {
  const auth = await requireRole(undefined, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  try {
    const station = await getMyStation(auth.sub);
    return successResponse(station);
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ForbiddenError) return error403(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
