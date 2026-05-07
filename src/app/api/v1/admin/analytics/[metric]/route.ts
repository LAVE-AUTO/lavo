import { requireRole } from '@/lib/require-role';
import { getAnalyticsSeries } from '@/server/admin/analytics-service';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import {
  VALID_METRICS,
  analyticsQuerySchema,
  resolveAnalyticsRange,
  mapZodErrors,
} from '@/validators/analytics';
import type { MetricSlug } from '@/validators/analytics';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/analytics/[metric]
 * Returns a timeseries for the requested metric over the given date range.
 *
 * Path param:
 *   [metric] - one of: transactions, revenue, commissions, registrations,
 *              stations, reservations, cancellations, support-tickets, avg-rating
 *
 * Query params (all optional):
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   → exact date range (both required if either is provided)
 *   ?group_by=day|week|month         → granularity (default: day)
 *   (no params)                      → default 30-day window ending now
 *
 * Response is never cached (Cache-Control: private, no-store) to ensure fresh data
 * for authenticated admin users.
 *
 * Responses:
 *   200 { data: { metric, group_by, period, series } }
 *   400 VALIDATION_FAILED  - unknown metric or invalid / inconsistent query params
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 *
 * Auth: admin role required.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ metric: string }> }
): Promise<NextResponse> {
  // Step 1: Authentication guard
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  // Step 2: Validate metric slug
  const { metric } = await params;

  if (!(VALID_METRICS as readonly string[]).includes(metric)) {
    return applyNoStoreHeaders(error400('Invalid metric', ApiCode.VALIDATION_FAILED));
  }

  // Step 3: Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const parsed = analyticsQuerySchema.safeParse({
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    group_by: searchParams.get('group_by') || undefined,
  });

  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  // Step 4: Fetch timeseries data
  try {
    const { from, to } = resolveAnalyticsRange(parsed.data);
    const data = await getAnalyticsSeries(
      metric as MetricSlug,
      from,
      to,
      parsed.data.group_by
    );

    return applyNoStoreHeaders(successResponse(data));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
