import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { login } from '@/server/auth/auth-service';
import { loginSchema, mapZodErrors } from '@/validators/auth';
import {
  successResponse,
  error400,
  error401,
  error403,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { checkRateLimit, recordFailedAttempt, resetOnSuccess } from '@/lib/rate-limiter';
import { getClientRateLimitKey } from '@/lib/request-ip';
import { buildRefreshCookieOptions } from '@/lib/jwt';
import { REFRESH_COOKIE_NAME } from '@/helpers/server-constants';

/**
 * POST /api/v1/auth/login
 * Authenticates a user with email and password.
 *
 * Body: { email, password, remember_me? }
 *
 * Responses:
 *   200 { message, data: { user, access_token, refresh_token, token_type, expires_in } }
 *   400 VALIDATION_FAILED  — invalid input
 *   401 INVALID_CREDENTIALS — wrong email or password
 *   403 FORBIDDEN          — account not active or suspended
 *   429 TOO_MANY_REQUESTS  — rate limit exceeded
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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const { user, tokens } = await login(parsed.data);

    await resetOnSuccess(ip);

    const res = successResponse({
      user,
      access_token: tokens.accessJwt,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
    }, 'Login successful');

    const response = NextResponse.json(await res.json(), { status: res.status });
    response.cookies.set(
      REFRESH_COOKIE_NAME,
      tokens.rawRefreshToken,
      buildRefreshCookieOptions(parsed.data.remember_me),
    );
    return response;
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      await recordFailedAttempt(ip);
      return error401('Invalid credentials', ApiCode.INVALID_CREDENTIALS);
    }
    if (e instanceof ForbiddenError) {
      return error403(e.message);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
