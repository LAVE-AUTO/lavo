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
import { getClientRateLimitKey } from '@/lib/request-ip';

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     description: >
 *       Verifies a user's email address using the one-time token sent by email.
 *       Returns the same error shape for both invalid and expired tokens to prevent
 *       token enumeration.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Verification token received by email.
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         verified:
 *                           type: boolean
 *                           example: true
 *       400:
 *         description: Invalid or expired verification token
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
