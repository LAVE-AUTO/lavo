import { requireAuth } from '@/lib/require-auth';
import { changePassword } from '@/server/auth/auth-service';
import { changePasswordSchema, mapZodErrors } from '@/validators/station';
import {
  successResponse,
  error400,
  error401,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, UnauthorizedError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/auth/change-password
 * Change the authenticated user's password.
 * Also clears the force_password_change flag when set.
 *
 * Body: { current_password, new_password, confirm_new_password }
 *
 * Responses:
 *   200 { data: { changed: true } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED — not authenticated or current password incorrect
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  // Allow access even when force_password_change = true (that's the point of this endpoint)
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth as NextResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    await changePassword(auth.sub, parsed.data.current_password, parsed.data.new_password);
    return successResponse({ changed: true }, 'Password changed successfully.');
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return error401(e.message);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
