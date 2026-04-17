import { headers } from 'next/headers';
import { forgotPassword } from '@/server/auth/auth-service';
import { forgotPasswordSchema, mapZodErrors } from '@/validators/auth';
import { extractLocale } from '@/lib/email';
import { successResponse, error400, error429, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limiter';
import { getClientRateLimitKey } from '@/lib/request-ip';

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     description: >
 *       Sends a password reset email when the account exists and is active.
 *       Always returns 200 to prevent email enumeration — the caller cannot determine
 *       whether an account with the given email exists.
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: >
 *           Reset email sent (if account exists). Always returned to prevent enumeration.
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
 *                         sent:
 *                           type: boolean
 *                           example: true
 *       400:
 *         description: Invalid email format
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

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  await recordFailedAttempt(ip);

  try {
    const locale = extractLocale(headersList.get('accept-language'));
    await forgotPassword(parsed.data.email, locale);
    return successResponse({ sent: true }, 'If an account exists, a reset email has been sent');
  } catch {
    return error500();
  }
}
