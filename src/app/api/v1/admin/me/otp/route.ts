import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error429, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { adminRequestOtpSchema, mapZodErrors } from '@/validators/admin-user';
import { requestOtp } from '@/server/admin/admin-profile-service';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import { OTP_RATE_LIMIT_MAX, OTP_RATE_LIMIT_WINDOW_MS } from '@/helpers/server-constants';
import type { NextResponse } from 'next/server';

const otpLimiter = createEndpointRateLimiter({ maxRequests: OTP_RATE_LIMIT_MAX, windowMs: OTP_RATE_LIMIT_WINDOW_MS });

/**
 * POST /api/v1/admin/me/otp
 * Generates and sends a 6-digit OTP to the admin's email for sensitive operations.
 *
 * Rate limited: 3 requests per 5 minutes per admin id.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: { sent: true } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   429 TOO_MANY_REQUESTS
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  if (otpLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = adminRequestOtpSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    await requestOtp(auth.sub, parsed.data.purpose);
    return applyNoStoreHeaders(successResponse({ sent: true }));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
