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
 * Response is never cached (Cache-Control: private, no-store) because it contains
 * sensitive admin data including PII (emails, names) in alert lists.
 *
 * Responses:
 *   200 { data: { period, totals, metrics, alerts } }
 *   400 VALIDATION_FAILED  - invalid or inconsistent query params
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 *
 * Auth: admin role required.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Step 1: Authentication guard
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  // Step 2: Parse and validate query parameters
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

  // Step 3: Fetch dashboard data
  try {
    const { from, to, days } = resolveDateRange(parsed.data);
    const data = await getDashboardData(from, to, days);

    return applyNoStoreHeaders(successResponse(data));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
