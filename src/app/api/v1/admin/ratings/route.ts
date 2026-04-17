/**
 * GET /api/v1/admin/ratings
 * Admin list of all ratings with filters, pagination, and user/station details. Auth: admin.
 *
 * Query: station_id?, is_visible? (true|false), score_min? (1-5), score_max? (1-5),
 *        from? (YYYY-MM-DD), to? (YYYY-MM-DD), sort_by (created_at|score), sort_order (asc|desc),
 *        page (default 1), limit (default 20, max 100)
 *
 * Responses:
 *   200 { data: { items: [{ id, score, comment, is_visible, created_at, reservation_id,
 *                           user: { id, first_name, last_name }, station: { id, name } }],
 *                 meta: PaginationMeta } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import { adminRatingsQuerySchema, mapZodErrors } from '@/validators/ratings';
import { listAllAdminRatings } from '@/server/ratings/rating-service';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';


// %%%%% Endpoint handler %%%%%
// GET /api/v1/admin/ratings

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  // Validate and parse query params
  const { searchParams } = new URL(request.url);
  const queryParsed = adminRatingsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(queryParsed.error))
    );
  }

  // Fetch admin ratings list
  try {
    const result = await listAllAdminRatings(queryParsed.data);
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
