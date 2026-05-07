// %%%%% Imports %%%%%

import { headers } from 'next/headers';

import { forgotPassword } from '@/server/auth/auth-service';
import { forgotPasswordSchema, mapZodErrors } from '@/validators/auth';
import { extractLocale } from '@/lib/email';
import {
  successResponse,
  error400,
  error429,
  error500,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limiter';
import { getClientRateLimitKey } from '@/lib/request-ip';


// %%%%% END - Imports %%%%%


// %%%%% Helpers %%%%%

/**
 * Parses the request body as JSON and validates it against the forgot-password
 * schema. Returns the validated data on success, or a ready-to-send Response on
 * failure so the caller can return early.
 */
async function parseBody(
  request: Request
): Promise<{ ok: true; email: string } | { ok: false; response: Response }> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: error400('Invalid JSON body', ApiCode.VALIDATION_FAILED),
    };
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: error400(
        'Validation failed',
        ApiCode.VALIDATION_FAILED,
        mapZodErrors(parsed.error)
      ),
    };
  }

  return { ok: true, email: parsed.data.email };
}


// %%%%% END - Helpers %%%%%


// %%%%% Route handler %%%%%

// ooooo POST ooooo

/**
 * POST /api/v1/auth/forgot-password
 *
 * Sends a password reset email when the account exists and is active.
 * Always returns 200 to prevent email enumeration - the caller cannot determine
 * whether an account with the given email exists.
 *
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     description: >
 *       Sends a password reset email when the account exists and is active.
 *       Always returns 200 to prevent email enumeration - the caller cannot determine
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
  const ip = getClientRateLimitKey(headersList);

  // Reject immediately if the IP is already over the rate-limit threshold.
  const { blocked } = await checkRateLimit(ip);
  if (blocked) return error429();

  const result = await parseBody(request);
  if (!result.ok) return result.response;

  // Count every reset request against the rate limit (whether or not an account
  // exists) to limit abuse. resetOnSuccess is intentionally NOT called here:
  // forgotPassword() silently returns for non-existent/inactive accounts without
  // throwing, so calling resetOnSuccess unconditionally would let an attacker
  // replay indefinitely against any email address without ever tripping the limiter.
  await recordFailedAttempt(ip);

  try {
    const locale = extractLocale(headersList.get('accept-language'));
    await forgotPassword(result.email, locale);

    return successResponse({ sent: true }, 'If an account exists, a reset email has been sent');
  } catch (e) {
    console.error(
      '[forgot-password] unexpected error:',
      e instanceof Error ? e.message : String(e)
    );
    return error500(e);
  }
}


// %%%%% END - Route handler %%%%%
