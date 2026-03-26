import { requireRole } from '@/lib/require-role';
import { extractLocale } from '@/lib/email';
import { approveStation } from '@/server/station/station-service';
import { isAdminActionRateLimited } from '@/server/admin/admin-log-repository';
import { successResponse, error400, error404, error409, error429, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { adminStationIdParamSchema, mapZodErrors } from '@/validators/station';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/admin/stations/:id/approve
 * Approve a station — sets status = active.
 * Requires admin role.
 *
 * Responses:
 *   200 { data: { approved: true } }
 *   400 VALIDATION_FAILED — :id is not a valid UUID
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND — station or owner not found
 *   409 CONFLICT — station not in pending_admin_validation state
 *   429 TOO_MANY_REQUESTS — rate limit exceeded
 *   500 INTERNAL_ERROR
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id } = await params;

  const paramParsed = adminStationIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid station id', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error))
    );
  }

  // H-4: Rate limit — max 20 approve/reject actions per admin per minute.
  if (await isAdminActionRateLimited(auth.sub, ['station_approved', 'station_rejected'])) {
    return applyNoStoreHeaders(error429());
  }

  const locale = extractLocale(request.headers.get('accept-language'));

  try {
    await approveStation(auth.sub, paramParsed.data.id, locale);
    return applyNoStoreHeaders(successResponse({ approved: true }, 'Station approved successfully.'));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ConflictError) return applyNoStoreHeaders(error409(e.message, ApiCode.CONFLICT));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
