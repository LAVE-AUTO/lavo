/**
 * GET /api/v1/ratings/me
 * List ratings submitted by the authenticated client, paginated by recency. Auth: client.
 *
 * Query params: page (default 1), limit (default 10, max 50)
 *
 * Responses:
 *   200 { data: { items: UserRatingItem[], meta: PaginationMeta } }
 *   400 VALIDATION_FAILED
 *   500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { getMyRatings } from '@/server/ratings/rating-service';
import { AppError } from '@/lib/errors';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));
  }

  const { page, limit } = parsed.data;

  try {
    const result = await getMyRatings(auth.sub, page, limit);
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
