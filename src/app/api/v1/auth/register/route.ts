import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { registerSchema, mapZodErrors } from '@/validators/auth';
import { registerWithPassword } from '@/server/auth/auth-service';
import { extractLocale } from '@/lib/email';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetOnSuccess,
} from '@/lib/rate-limiter';
import { getClientRateLimitKey } from '@/lib/request-ip';
import {
  successResponse,
  error400,
  error409,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { HTTP_STATUS, REFRESH_COOKIE_NAME } from '@/helpers/constants';
import { AppError, ConflictError } from '@/lib/errors';
import { buildRefreshCookieOptions } from '@/lib/jwt';

/**
 * POST /api/v1/auth/register
 * Register a new client account with email and password.
 *
 * Body: { first_name, last_name, email, phone, password, confirm_password, remember_me? }
 *
 * Responses:
 *   201 { message, data: { user, access_token, refresh_token, token_type, expires_in } }
 *   400 VALIDATION_FAILED  — invalid input
 *   409 EMAIL_ALREADY_EXISTS — duplicate email
 *   429 TOO_MANY_REQUESTS  — rate limit exceeded
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const headersList = await headers();
  const ip = getClientRateLimitKey(headersList as unknown as Headers);

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip confirm_password for service
    const { confirm_password: _, ...dto } = parsed.data;
    const locale = extractLocale(headersList.get('accept-language'));
    const { user, tokens } = await registerWithPassword(dto, locale);

    await resetOnSuccess(ip);

    const res = successResponse(
      {
        user,
        access_token: tokens.accessJwt,
        token_type: 'Bearer',
        expires_in: tokens.expiresIn,
      },
      'Registration successful',
      HTTP_STATUS.CREATED
    );

    const response = NextResponse.json(await res.json(), { status: res.status });
    response.cookies.set(
      REFRESH_COOKIE_NAME,
      tokens.rawRefreshToken,
      buildRefreshCookieOptions(dto.remember_me),
    );
    return response;
  } catch (e) {
    await recordFailedAttempt(ip);
    if (e instanceof ConflictError) {
      return error409('Email already in use', ApiCode.EMAIL_ALREADY_EXISTS);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
