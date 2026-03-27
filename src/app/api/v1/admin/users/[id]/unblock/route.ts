import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError, ConflictError } from '@/lib/errors';
import { adminIdParamSchema, mapZodErrors } from '@/validators/admin-user';
import { unblockUser } from '@/server/admin/admin-management-service';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/admin/users/:id/unblock
 * Sets user status to 'active' and clears auth rate limits.
 * Logs the action in admin_logs.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: AdminSafeUser }
 *   400 VALIDATION_FAILED  — invalid UUID param
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND          — user not found
 *   409 CONFLICT           — account is already active
 *   500 INTERNAL_ERROR
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id } = await params;
  const paramParsed = adminIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid user id', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error))
    );
  }

  try {
    const user = await unblockUser(auth.sub, paramParsed.data.id);
    return applyNoStoreHeaders(successResponse(user, 'Account unblocked successfully'));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ConflictError) return applyNoStoreHeaders(error409(e.message, ApiCode.CONFLICT));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
