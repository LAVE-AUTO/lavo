import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { AppError, NotFoundError, ConflictError, TokenExpiredError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { adminEmailChangeSchema, mapZodErrors } from '@/validators/admin-user';
import { changeAdminEmail } from '@/server/admin/admin-profile-service';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/admin/me/email
 * Changes the authenticated admin's email address after OTP verification.
 *
 * The caller must first POST /api/v1/admin/me/otp with purpose='email_change'
 * to receive the 6-digit code required here.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: SafeAdminProfile }
 *   400 VALIDATION_FAILED | TOKEN_EXPIRED (wrong/expired OTP)
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   409 CONFLICT (email already in use)
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

  const parsed = adminEmailChangeSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const profile = await changeAdminEmail(auth.sub, parsed.data.new_email, parsed.data.otp_code);
    return applyNoStoreHeaders(successResponse(profile, 'Email updated successfully'));
  } catch (e) {
    if (e instanceof TokenExpiredError) return applyNoStoreHeaders(error400(e.message, ApiCode.TOKEN_EXPIRED));
    if (e instanceof NotFoundError)     return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ConflictError)     return applyNoStoreHeaders(error409(e.message, ApiCode.EMAIL_ALREADY_EXISTS));
    if (e instanceof AppError)          return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
