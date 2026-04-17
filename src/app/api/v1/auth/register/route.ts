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
import { HTTP_STATUS } from '@/helpers/constants';
import { REFRESH_COOKIE_NAME } from '@/helpers/server-constants';
import { AppError, ConflictError } from '@/lib/errors';
import { buildRefreshCookieOptions } from '@/lib/jwt';

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new client account
 *     description: >
 *       Creates a new client account with email and password.
 *       Returns access and refresh tokens on success. A verification email is sent automatically.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - first_name
 *               - last_name
 *               - email
 *               - phone
 *               - password
 *               - confirm_password
 *             properties:
 *               first_name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               last_name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 320
 *               phone:
 *                 type: string
 *                 description: E.164 format phone number (e.g. +33612345678)
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 128
 *                 description: >
 *                   Must contain at least one uppercase letter, one lowercase letter,
 *                   one digit, and one special character from @ $ ! % * # ? & _ - + =
 *               confirm_password:
 *                 type: string
 *               remember_me:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Account created successfully
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
 *       409:
 *         description: Email already in use
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
  const ip = getClientRateLimitKey(headersList as Headers);

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
