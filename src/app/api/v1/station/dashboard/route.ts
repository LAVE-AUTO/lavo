/**
 * @swagger
 * /station/dashboard:
 *   get:
 *     summary: Get the station KPI dashboard for the current month
 *     description: >
 *       Returns key performance indicators for the authenticated station for the
 *       current calendar month: total revenue, client count, completed services,
 *       average rating, and pending entry count.
 *     tags:
 *       - Station
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Station KPI dashboard
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/StationDashboard'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         description: Forbidden — station role required or not approved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: No station associated with this account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
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
