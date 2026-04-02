/**
 * GET /api/v1/station/dashboard
 * Returns KPI summary for the authenticated station's current calendar month.
 *
 * Response:
 *   200 { data: { total_revenue, total_clients, total_completed, average_rating, pending_count, month } }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN — not a station or not yet approved
 *   404 NOT_FOUND — no station associated with this account
 *   500 INTERNAL_ERROR
 *
 * Auth: station role required (active station).
 */
import type { NextResponse } from 'next/server';

import { requireRole } from '@/lib/require-role';
import { successResponse, error404, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationByUserId } from '@/server/station/station-repository';
import { getStationDashboard } from '@/server/station/station-analytics-service';


// %%%%% GET Handler %%%%%
// Retrieve dashboard KPIs for authenticated station

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const data = await getStationDashboard(station.id);
    return applyNoStoreHeaders(successResponse(data));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    console.error('[GET /api/v1/station/dashboard] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
