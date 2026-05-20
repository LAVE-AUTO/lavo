import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import { disputeIdParamSchema } from '@/validators/dispute';
import { getDisputeByIdAdmin } from '@/server/disputes/dispute-service';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/disputes/:id
 * Returns a single dispute with enriched client contact and station contact info.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: DisputeWithDetails }
 *   400 VALIDATION_FAILED - invalid UUID
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND - dispute not found
 *   500 INTERNAL_ERROR
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const idResult = disputeIdParamSchema.safeParse(id);
  if (!idResult.success) {
    return applyNoStoreHeaders(error400('Invalid dispute ID format', ApiCode.VALIDATION_FAILED));
  }

  try {
    const dispute = await getDisputeByIdAdmin(idResult.data);
    return applyNoStoreHeaders(successResponse(dispute));
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) {
      return applyNoStoreHeaders(error404(e.message));
    }
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    console.error('[GET /api/v1/admin/disputes/:id] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
