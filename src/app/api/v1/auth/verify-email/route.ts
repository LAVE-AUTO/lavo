import { headers } from 'next/headers';
import { verifyEmail } from '@/server/auth/auth-service';
import { verifyEmailSchema, mapZodErrors } from '@/validators/auth';
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

/**
 * POST /api/v1/auth/verify-email
 * Verifies a user's email address using the token sent by email.
 *
 * Body: { token: string }
 *
 * Responses:
 *   200 { data: { verified: true } }
 *   400 VALIDATION_FAILED — token missing from body
 *   400 TOKEN_EXPIRED     — invalid or expired verification token
 *   429 TOO_MANY_REQUESTS — rate limit exceeded
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  const { blocked } = await checkRateLimit(ip);
  if (blocked) return error429();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    await verifyEmail(parsed.data.token);
    await resetOnSuccess(ip);
    return successResponse({ verified: true }, 'Email verified successfully');
  } catch (e) {
    if (e instanceof TokenExpiredError || e instanceof NotFoundError) {
      await recordFailedAttempt(ip);
      return error400('Invalid or expired verification token.', ApiCode.TOKEN_EXPIRED);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
