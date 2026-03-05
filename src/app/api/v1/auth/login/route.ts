import { headers } from 'next/headers';
import { login } from '@/server/auth/auth-service';
import { loginSchema, mapZodErrors } from '@/validators/auth';
import { buildAccessCookieOptions, buildRefreshCookieOptions } from '@/lib/jwt';
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

/**
 * POST /api/v1/auth/login
 * Authenticates a user with email and password.
 *
 * Body: { email, password, remember_me? }
 *
 * Responses:
 *   200 { message, data: SafeUser }
 *   400 VALIDATION_FAILED  — invalid input
 *   401 INVALID_CREDENTIALS — wrong email or password
 *   403 FORBIDDEN          — account not active or suspended
 *   429 TOO_MANY_REQUESTS  — rate limit exceeded
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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const { user, tokens, rememberMe } = await login(parsed.data);

    await resetOnSuccess(ip);

    const accessOpts = buildAccessCookieOptions();
    const refreshOpts = buildRefreshCookieOptions(rememberMe);
    const response = successResponse(user, 'Login successful');
    response.cookies.set(accessOpts.name, tokens.accessJwt, accessOpts);
    response.cookies.set(refreshOpts.name, tokens.rawRefreshToken, refreshOpts);
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
