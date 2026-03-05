import { headers } from 'next/headers';
import { registerSchema, mapZodErrors } from '@/validators/auth';
import { registerWithPassword } from '@/server/auth/auth-service';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetOnSuccess,
} from '@/lib/rate-limiter';
import { buildAccessCookieOptions, buildRefreshCookieOptions } from '@/lib/jwt';
import {
  successResponse,
  error400,
  error409,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { HTTP_STATUS } from '@/helpers/constants';
import { AppError, ConflictError } from '@/lib/errors';

/**
 * POST /api/v1/auth/register
 * Register a new client account with email and password.
 *
 * Body: { first_name, last_name, email, phone, password, remember_me? }
 *
 * Responses:
 *   201 { message, data: SafeUser }
 *   400 VALIDATION_FAILED  — invalid input
 *   409 EMAIL_ALREADY_EXISTS — duplicate email
 *   429 TOO_MANY_REQUESTS  — rate limit exceeded
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  const { blocked, retryAfter } = await checkRateLimit(ip);
  if (blocked) return error429();
  void retryAfter;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    await recordFailedAttempt(ip);
    return error400(
      'Validation failed',
      ApiCode.VALIDATION_FAILED,
      mapZodErrors(parsed.error)
    );
  }

  try {
    const { user, tokens, rememberMe } = await registerWithPassword(parsed.data);

    await resetOnSuccess(ip);

    const accessOpts = buildAccessCookieOptions();
    const refreshOpts = buildRefreshCookieOptions(rememberMe);
    const response = successResponse(
      user,
      'Registration successful',
      HTTP_STATUS.CREATED
    );
    response.cookies.set(accessOpts.name, tokens.accessJwt, accessOpts);
    response.cookies.set(refreshOpts.name, tokens.rawRefreshToken, refreshOpts);
    return response;
  } catch (e) {
    if (e instanceof ConflictError) {
      return error409('Email already in use', ApiCode.EMAIL_ALREADY_EXISTS);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
