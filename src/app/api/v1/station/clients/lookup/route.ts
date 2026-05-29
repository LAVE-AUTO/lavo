/**
 * GET /api/v1/station/clients/lookup?email=foo@bar.com
 *
 * Station-scoped client lookup by email. Used by the manual walk-in
 * modal so the merchant can see, before submitting, whether the email
 * they typed belongs to a registered Hurryline user.
 *
 * Privacy: only stations can call this endpoint, response is the
 * client's first/last name (never email confirmation outside what was
 * sent in) and never reveals the user_id.
 * Rate limited: 30 lookups per minute per station to prevent email enumeration.
 *
 * Response (matched):   { data: { matched: true, first_name, last_name } }
 * Response (unmatched): { data: { matched: false } }
 */
import { z } from 'zod';
import type { NextResponse } from 'next/server';
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error429, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findByEmail } from '@/server/auth/user-repository';
import { checkSlidingWindowRateLimit, normalizeRateLimitKey } from '@/lib/rate-limiter';

const LOOKUP_LIMIT = 30;
const LOOKUP_WINDOW_SECS = 60;

const querySchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email')
    .max(320, 'Email must not exceed 320 characters'),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const rateLimitKey = normalizeRateLimitKey(`station:client-lookup:${auth.sub}`);
  const { allowed } = await checkSlidingWindowRateLimit(rateLimitKey, LOOKUP_LIMIT, LOOKUP_WINDOW_SECS);
  if (!allowed) return applyNoStoreHeaders(error429());

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Invalid email', ApiCode.VALIDATION_FAILED));
  }

  try {
    const user = await findByEmail(parsed.data.email);
    /* Only match real client accounts. Stations / admins keep matched=false
     * so the merchant never accidentally enqueues a station owner as a
     * walk-in client. Deleted accounts (status='deleted') are also
     * filtered out. */
    if (!user || user.role !== 'client' || user.status === 'deleted') {
      return applyNoStoreHeaders(successResponse({ matched: false }));
    }
    return applyNoStoreHeaders(
      successResponse({
        matched: true,
        first_name: user.first_name,
        last_name: user.last_name,
      })
    );
  } catch (e) {
    return applyNoStoreHeaders(error500(e));
  }
}
