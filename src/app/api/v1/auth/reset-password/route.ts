import { resetPassword } from '@/server/auth/auth-service';
import { resetPasswordSchema, mapZodErrors } from '@/validators/auth';
import {
  successResponse,
  error400,
  error404,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError, TokenExpiredError } from '@/lib/errors';

/**
 * POST /api/v1/auth/reset-password
 * Resets the user's password using a valid reset token.
 *
 * Body: { token: string, new_password: string }
 *
 * Responses:
 *   200 { data: { reset: true } }
 *   400 VALIDATION_FAILED — invalid input or weak password
 *   400 TOKEN_EXPIRED     — token exists but has expired or been used
 *   404 NOT_FOUND         — token does not exist
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.new_password);
    return successResponse({ reset: true }, 'Password updated successfully');
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      return error400('Reset token has expired or already been used', ApiCode.TOKEN_EXPIRED);
    }
    if (e instanceof NotFoundError) {
      return error404('Reset token not found', ApiCode.NOT_FOUND);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
