import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error401, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, NotFoundError, TokenExpiredError, UnauthorizedError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { adminPasswordChangeSchema, mapZodErrors } from '@/validators/admin-user';
import { changeAdminPassword } from '@/server/admin/admin-profile-service';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/admin/me/password
 * Changes the authenticated admin's password after OTP and current-password verification.
 *
 * The caller must first POST /api/v1/admin/me/otp with purpose='password_change'
 * to receive the 6-digit code required here.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: { updated: true } }
 *   400 VALIDATION_FAILED | TOKEN_EXPIRED (wrong/expired OTP)
 *   401 UNAUTHORIZED (wrong current password)
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = adminPasswordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    await changeAdminPassword(
      auth.sub,
      parsed.data.current_password,
      parsed.data.new_password,
      parsed.data.otp_code
    );
    return applyNoStoreHeaders(successResponse({ updated: true }));
  } catch (e) {
    if (e instanceof TokenExpiredError)  return applyNoStoreHeaders(error400(e.message, ApiCode.TOKEN_EXPIRED));
    if (e instanceof UnauthorizedError)  return applyNoStoreHeaders(error401(e.message));
    if (e instanceof NotFoundError)      return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError)           return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
