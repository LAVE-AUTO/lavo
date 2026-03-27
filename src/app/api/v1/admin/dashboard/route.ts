import { requireRole } from '@/lib/require-role';
import { getDashboardData } from '@/server/admin/dashboard-service';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import { dashboardQuerySchema, resolveDateRange, mapZodErrors } from '@/validators/dashboard';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/dashboard
 * Returns admin KPI snapshot: stock totals, period flow metrics, and actionable alerts.
 *
 * Query params (all optional):
 *   ?period=N                          → N-day window ending now (1 ≤ N ≤ 365)
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD     → exact date range for flow KPIs
 *   (no params)                        → default 30-day window
 *
 * Response is cached at the edge for 60 seconds (Cache-Control: max-age=60, s-maxage=60).
 *
 * Responses:
 *   200 { data: { period, totals, metrics, alerts } }
 *   400 VALIDATION_FAILED  — invalid or inconsistent query params
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { searchParams } = new URL(request.url);
  const parsed = dashboardQuerySchema.safeParse({
    // Use || instead of ?? so empty string "" becomes undefined (avoids NaN from z.coerce.number()).
    period: searchParams.get('period') || undefined,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
  });

  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const { from, to, days } = resolveDateRange(parsed.data);
    const data = await getDashboardData(from, to, days);

    const response = successResponse(data);
    response.headers.set('Cache-Control', 'private, max-age=60');
    return response;
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
