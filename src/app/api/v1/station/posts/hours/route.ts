/**
 * GET /api/v1/station/posts/hours - per-post availability windows for every
 * active post of the station (each post's 7-day schedule, inheriting the station
 * hours where no override is set). Auth: station.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error404, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { getStationPostHours } from '@/server/station/station-post-hours-service';
import { findStationByUserId } from '@/server/station/station-repository';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const data = await getStationPostHours(station.id);
    return applyNoStoreHeaders(successResponse(data));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
