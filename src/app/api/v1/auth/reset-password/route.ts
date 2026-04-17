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
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using a one-time token
 *     description: >
 *       Resets the user's password using the token received via the forgot-password email.
 *       Returns the same error for both invalid and expired tokens to prevent enumeration.
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
 *               - new_password
 *               - confirm_new_password
 *             properties:
 *               token:
 *                 type: string
 *                 description: Reset token from the password reset email.
 *               new_password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 128
 *                 description: >
 *                   Must contain at least one uppercase letter, one lowercase letter,
 *                   one digit, and one special character from @ $ ! % * # ? & _ - + =
 *               confirm_new_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
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
 *                         reset:
 *                           type: boolean
 *                           example: true
 *       400:
 *         description: Validation failed or invalid/expired token
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
