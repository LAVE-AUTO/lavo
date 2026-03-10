import { headers } from 'next/headers';
import { resetPassword } from '@/server/auth/auth-service';
import { resetPasswordSchema, mapZodErrors } from '@/validators/auth';
import {
  successResponse,
  error400,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError, TokenExpiredError } from '@/lib/errors';
import { checkRateLimit, recordFailedAttempt, resetOnSuccess } from '@/lib/rate-limiter';
import { getClientRateLimitKey } from '@/lib/request-ip';

/**
 * POST /api/v1/auth/reset-password
 * Resets the user's password using a valid reset token.
 *
 * Body: { token: string, new_password: string }
 *
 * Responses:
 *   200 { data: { reset: true } }
 *   400 VALIDATION_FAILED — invalid input or weak password
 *   400 TOKEN_EXPIRED     — invalid or expired reset token (same message for not found/expired to prevent enumeration)
 *   429 TOO_MANY_REQUESTS — rate limit exceeded
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const headersList = await headers();
  const ip = getClientRateLimitKey(headersList as unknown as Headers);

  const { blocked } = await checkRateLimit(ip);
  if (blocked) return error429();

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
    await resetOnSuccess(ip);
    return successResponse({ reset: true }, 'Password updated successfully');
  } catch (e) {
    if (e instanceof TokenExpiredError || e instanceof NotFoundError) {
      await recordFailedAttempt(ip);
      return error400('Invalid or expired reset token. Request a new password reset link.', ApiCode.TOKEN_EXPIRED);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
