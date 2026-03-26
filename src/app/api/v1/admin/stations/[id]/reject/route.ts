import { requireRole } from '@/lib/require-role';
import { rejectStation } from '@/server/station/station-service';
import { isAdminActionRateLimited } from '@/server/admin/admin-log-repository';
import { adminStationIdParamSchema, rejectStationSchema, mapZodErrors } from '@/validators/station';
import {
  successResponse,
  error400,
  error404,
  error409,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/admin/stations/:id/reject
 * Reject a station — sets status = rejected + rejection_reason.
 * Requires admin role.
 *
 * Body: { rejection_reason }
 *
 * Responses:
 *   200 { data: { rejected: true } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = rejectStationSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    await rejectStation(auth.sub, paramParsed.data.id, parsed.data.rejection_reason);
    return applyNoStoreHeaders(successResponse({ rejected: true }, 'Station rejected.'));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ConflictError) return applyNoStoreHeaders(error409(e.message, ApiCode.CONFLICT));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
