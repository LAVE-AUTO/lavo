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
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate a user
 *     description: >
 *       Validates credentials and returns a short-lived access token plus an httpOnly
 *       refresh token cookie. Rate-limited to prevent brute force attacks.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - expected_role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 320
 *               password:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 128
 *               expected_role:
 *                 type: string
 *                 enum: [client, station, admin]
 *                 description: >
 *                   Must match the authenticated user's actual role.
 *                   Prevents cross-space token issuance.
 *               remember_me:
 *                 type: boolean
 *                 default: false
 *                 description: Extends the refresh token cookie lifetime.
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TokensResponse'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         description: Account not active or suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       429:
 *         description: Too many requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
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
