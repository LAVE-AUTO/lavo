import { type NextRequest } from 'next/server';
import { verifyEmail } from '@/server/auth/auth-service';
import {
  successResponse,
  error400,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError } from '@/lib/errors';

/**
 * GET /api/v1/auth/verify-email?token=<token>
 * Verifies a user's email address using the token sent by email.
 *
 * Responses:
 *   200 { data: { verified: true } }
 *   400 VALIDATION_FAILED — token missing or invalid/expired
 *   500 INTERNAL_ERROR
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return error400('Verification token is required', ApiCode.VALIDATION_FAILED);
  }

  try {
    await verifyEmail(token);
    return successResponse({ verified: true }, 'Email verified successfully');
  } catch (e) {
    if (e instanceof NotFoundError) {
      return error400('Invalid or expired verification token', ApiCode.VALIDATION_FAILED);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
