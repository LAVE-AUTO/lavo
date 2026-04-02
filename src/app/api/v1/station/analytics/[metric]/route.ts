/**
 * GET /api/v1/station/analytics/[metric]
 * Returns a daily time series for the authenticated station over the past 30 days
 * or a specified from/to date range.
 *
 * Path param:
 *   [metric] — one of: revenue, clients, completed
 *
 * Query params (all optional):
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD → exact date range (both required if either is provided)
 *   (no params)                    → default 30-day window ending today
 *
 * Response:
 *   200 { data: { metric, series: [{ date, value }] } }
 *   400 VALIDATION_FAILED — unknown metric or invalid query params
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN — not a station or not yet approved
 *   404 NOT_FOUND — no station associated with this account
 *   500 INTERNAL_ERROR
 *
 * Auth: station role required (active station).
 */
import { requireRole } from '@/lib/require-role';
import { findStationByUserId } from '@/server/station/station-repository';
import { getStationAnalyticsSeries } from '@/server/station/station-analytics-service';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import {
  STATION_METRICS,
  stationAnalyticsQuerySchema,
  resolveStationAnalyticsRange,
  mapZodErrors,
} from '@/validators/station-analytics';
import type { StationMetricSlug } from '@/validators/station-analytics';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ metric: string }> };

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

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
    return applyNoStoreHeaders(error500(e));
  }
}
