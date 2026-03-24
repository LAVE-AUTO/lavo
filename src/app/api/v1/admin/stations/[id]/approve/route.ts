import { requireRole } from '@/lib/require-role';
import { extractLocale } from '@/lib/email';
import { approveStation } from '@/server/station/station-service';
import { successResponse, error400, error403, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { adminStationIdParamSchema, mapZodErrors } from '@/validators/station';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/admin/stations/:id/approve
 * Approve a station — sets status = active.
 * Requires admin role.
 *
 * Responses:
 *   200 { data: { approved: true } }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN — station not in pending_admin_validation state
 *   404 NOT_FOUND
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

  const locale = extractLocale(request.headers.get('accept-language'));

  try {
    await approveStation(auth.sub, paramParsed.data.id, locale);
    return applyNoStoreHeaders(successResponse({ approved: true }, 'Station approved successfully.'));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ForbiddenError) return applyNoStoreHeaders(error403(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
