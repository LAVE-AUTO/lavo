import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stations } from '@/lib/db/schema';
import { requireAuthWithPasswordCheck } from '@/lib/require-role';
import { successResponse, error403, error404, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/station/status
 * Returns the current status and rejection reason for the authenticated station user.
 * Does NOT require the station to be active — works for pending and rejected stations.
 * Used by the frontend to display the rejection reason on the KYC rejected page.
 *
 * Responses:
 *   200 { data: { status, name, rejection_reason } }
 *   403 FORBIDDEN — if user is not a station
 *   404 NOT_FOUND — if no station found for this user
 *   500 INTERNAL_ERROR
 */
export async function GET(request: Request) {
  const auth = await requireAuthWithPasswordCheck(request);
  if (auth instanceof Response) return auth as NextResponse;

  if (auth.role !== 'station') {
    return error403('Access restricted to station accounts', ApiCode.FORBIDDEN);
  }

  try {
    const station = await db.query.stations.findFirst({
      where: eq(stations.user_id, auth.sub),
      columns: { id: true, name: true, status: true, rejection_reason: true },
    });

    if (!station) {
      return error404('No station found for this account');
    }

    return successResponse({
      status: station.status,
      name: station.name,
      rejection_reason: station.rejection_reason ?? null,
    });
  } catch (e) {
    return error500(e);
  }
}
