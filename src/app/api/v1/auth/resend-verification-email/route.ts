// %%%%% Imports %%%%%

import { headers } from 'next/headers';

import { resendVerificationEmail } from '@/server/auth/auth-service';
import { resendEmailSchema, mapZodErrors } from '@/validators/auth';
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


// %%%%% Route handler %%%%%

// ooooo POST ooooo

/**
 * POST /api/v1/auth/resend-verification-email
 *
 * Sends a new email verification link to the given address.
 *
 * Always returns 200 regardless of whether the account exists or is already
 * verified, to prevent email enumeration attacks.
 *
 * Body:      { email: string }
 * Responses:
 *   200  { data: { sent: true } }
 *   400  VALIDATION_FAILED — invalid email format
 *   429  TOO_MANY_REQUESTS — rate limit exceeded
 *   500  INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const headersList = await headers();
  const ip = getClientRateLimitKey(headersList);

  // Reject immediately if the IP is already over the rate-limit threshold.
  const { blocked } = await checkRateLimit(ip);
  if (blocked) return error429();

  // Parse body — return 400 on malformed JSON before schema validation.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = resendEmailSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  // Rate-count every resend attempt (successful parse or not) to limit abuse.
  await recordFailedAttempt(ip);

  // Fire-and-forget: silently absorbs NotFoundError (no account) and ConflictError
  // (already verified) so the response is always 200 — callers cannot enumerate
  // whether an address is registered or has already been verified.
  try {
    const locale = extractLocale(headersList.get('accept-language'));
    await resendVerificationEmail(parsed.data.email, locale);
  } catch (e) {
    // Log unexpected server errors only; domain errors (NotFound/Conflict) are intentionally swallowed.
    const isExpectedDomainError =
      e instanceof Error &&
      (e.constructor.name === 'NotFoundError' || e.constructor.name === 'ConflictError');

    if (!isExpectedDomainError) {
      console.error(
        '[resend-verification-email] unexpected error:',
        e instanceof Error ? e.message : String(e)
      );
      return error500(e);
    }
  }

  return successResponse({ sent: true }, 'If an unverified account exists, a verification email has been sent');
}


// %%%%% END - Route handler %%%%%
