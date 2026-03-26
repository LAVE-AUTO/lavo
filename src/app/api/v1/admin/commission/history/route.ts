import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import { commissionHistoryQuerySchema, mapZodErrors } from '@/validators/commission';
import { getCommissionHistory } from '@/server/admin/commission-service';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/commission/history
 * Returns the paginated history of all commission rate changes, newest first.
 * Each entry shows rate, previous_rate, who set it, and when it became effective.
 *
 * Role: admin only.
 *
 * Query params: page, per_page
 *
 * Responses:
 *   200 { data: { history: CommissionRow[], meta: { total, page, per_page, total_pages } } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET(request: Request) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { searchParams } = new URL(request.url);
  const parsed = commissionHistoryQuerySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    per_page: searchParams.get('per_page') ?? undefined,
  });

  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const result = await getCommissionHistory(parsed.data.page, parsed.data.per_page);
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
