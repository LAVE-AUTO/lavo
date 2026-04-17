import { requireRole } from '@/lib/require-role';
import { getMyStation } from '@/server/station/station-service';
import { successResponse, error403, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
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
export async function GET(): Promise<NextResponse> {
  const auth = await requireRole(undefined, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const station = await getMyStation(auth.sub);
    return applyNoStoreHeaders(successResponse(station));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ForbiddenError) return applyNoStoreHeaders(error403(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
