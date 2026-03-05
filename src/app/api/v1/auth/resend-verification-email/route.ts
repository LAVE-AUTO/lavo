import { headers } from 'next/headers';
import { resendVerificationEmail } from '@/server/auth/auth-service';
import { resendEmailSchema, mapZodErrors } from '@/validators/auth';
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
import { checkRateLimit, recordFailedAttempt, resetOnSuccess } from '@/lib/rate-limiter';

/**
 * POST /api/v1/auth/resend-verification-email
 * Sends a new email verification link to the given address.
 *
 * Body: { email: string }
 *
 * Responses:
 *   200 { data: { sent: true } }
 *   400 VALIDATION_FAILED — invalid email format
 *   404 NOT_FOUND         — no account with this email
 *   409 CONFLICT          — email is already verified
 *   429 TOO_MANY_REQUESTS — rate limit exceeded
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  const { blocked } = await checkRateLimit(ip);
  if (blocked) return error429();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = resendEmailSchema.safeParse(body);
  if (!parsed.success) {
    await recordFailedAttempt(ip);
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    await resendVerificationEmail(parsed.data.email);
    await resetOnSuccess(ip);
    return successResponse({ sent: true }, 'Verification email sent');
  } catch (e) {
    if (e instanceof NotFoundError) {
      return error404('No account found with this email address', ApiCode.NOT_FOUND);
    }
    if (e instanceof ConflictError) {
      return error409('Email is already verified', ApiCode.CONFLICT);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
