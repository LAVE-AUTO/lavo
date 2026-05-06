import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import { transactionLogsQuerySchema, mapZodErrors } from '@/validators/commission';
import { getTransactionLogs } from '@/server/admin/transaction-log-service';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/transactions/logs
 * Returns paginated transaction logs aggregated from reservations, tips, and penalties.
 * Ordered by created_at descending.
 *
 * Role: admin only.
 *
 * Query params:
 *   page         - page number (default: 1)
 *   per_page     - items per page (default: 20, max: 100)
 *   type         - filter by business type: reservation | tip | penalty
 *   station_id   - filter by station UUID
 *   date_from    - ISO date-time lower bound on created_at
 *   date_to      - ISO date-time upper bound on created_at
 *
 * Responses:
 *   200 { data: { logs: TransactionLog[], meta: { total, page, per_page, total_pages } } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET(request: Request) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { searchParams } = new URL(request.url);
  const parsed = transactionLogsQuerySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    per_page: searchParams.get('per_page') ?? undefined,
    type: searchParams.get('type') ?? undefined,
    station_id: searchParams.get('station_id') ?? undefined,
    date_from: searchParams.get('date_from') ?? undefined,
    date_to: searchParams.get('date_to') ?? undefined,
  });

  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  const { page, per_page, type, station_id, date_from, date_to } = parsed.data;

  try {
    const result = await getTransactionLogs(
      { type, station_id, date_from, date_to },
      page,
      per_page
    );
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
