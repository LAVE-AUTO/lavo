/**
 * @swagger
 * /station/analytics/{metric}:
 *   get:
 *     summary: Get a daily analytics time series for the station
 *     description: >
 *       Returns a daily time series for the authenticated station for the given metric.
 *       Defaults to the past 30 days when no date range is specified.
 *       Both from and to must be provided together when using a custom range.
 *     tags:
 *       - Station
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: metric
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [revenue, clients, completed]
 *         description: The metric to retrieve.
 *       - name: from
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD). Required together with "to".
 *       - name: to
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD). Required together with "from".
 *     responses:
 *       200:
 *         description: Daily time series for the requested metric
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AnalyticsSeries'
 *       400:
 *         description: Unknown metric or invalid query params
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         description: Forbidden - station role required or not approved
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
 *       429:
 *         description: Too many requests
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
import { successResponse, error400, error404, error429, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationByUserId } from '@/server/station/station-repository';
import { getStationAnalyticsSeries } from '@/server/station/station-analytics-service';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';

// SECURITY: rate-limit analytics queries to 30 per minute per station user
const analyticsLimiter = createEndpointRateLimiter({ maxRequests: 30, windowMs: 60_000 });

import {
  STATION_METRICS,
  stationAnalyticsQuerySchema,
  resolveStationAnalyticsRange,
  mapZodErrors,
} from '@/validators/station-analytics';
import type { StationMetricSlug } from '@/validators/station-analytics';


type Params = { params: Promise<{ metric: string }> };


// %%%%% GET Handler %%%%%
// Retrieve analytics time series for authenticated station

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  if (analyticsLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

  const { metric } = await params;

  if (!(STATION_METRICS as readonly string[]).includes(metric)) {
    return applyNoStoreHeaders(error400('Invalid metric', ApiCode.VALIDATION_FAILED));
  }

  const { searchParams } = new URL(request.url);
  const parsed = stationAnalyticsQuerySchema.safeParse({
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
  });

  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const { from, to } = resolveStationAnalyticsRange(parsed.data);
    const data = await getStationAnalyticsSeries(station.id, metric as StationMetricSlug, from, to);
    return applyNoStoreHeaders(successResponse(data));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    console.error('[GET /api/v1/station/analytics] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
