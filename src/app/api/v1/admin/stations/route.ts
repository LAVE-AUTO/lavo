import { requireRole } from '@/lib/require-role';
import { getPendingStations, getStationsForAdmin } from '@/server/station/station-service';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import { listPendingStationsQuerySchema, mapZodErrors } from '@/validators/station';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

const ALLOWED_STATUSES = ['pending_admin_validation', 'active', 'rejected', 'suspended'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

/**
 * GET /api/v1/admin/stations
 * Lists stations for admin management with pagination.
 *
 * Query params:
 *   status    pending_admin_validation | active | rejected | suspended | all
 *             (omit = pending only, legacy behaviour)
 *   page      (default 1)
 *   per_page  (default 20 for pending, 50 for other cases — max 100)
 *
 * Responses:
 *   200 { data: { stations: Station[], meta: PaginationMeta } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { searchParams } = new URL(request.url);
  const parsed = listPendingStationsQuerySchema.safeParse({
    page:     searchParams.get('page')     || undefined,
    per_page: searchParams.get('per_page') || undefined,
  });

  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const statusParam = searchParams.get('status');

    if (!statusParam) {
      const result = await getPendingStations(parsed.data.page, parsed.data.per_page);
      return applyNoStoreHeaders(successResponse(result));
    }

    if (statusParam === 'all') {
      const result = await getStationsForAdmin(undefined, parsed.data.page, parsed.data.per_page);
      return applyNoStoreHeaders(successResponse(result));
    }

    if (ALLOWED_STATUSES.includes(statusParam as AllowedStatus)) {
      const result = await getStationsForAdmin(statusParam, parsed.data.page, parsed.data.per_page);
      return applyNoStoreHeaders(successResponse(result));
    }

    // Unknown status value → fall back to pending
    const result = await getPendingStations(parsed.data.page, parsed.data.per_page);
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
