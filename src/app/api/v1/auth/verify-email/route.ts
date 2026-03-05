import { verifyEmail } from '@/server/auth/auth-service';
import { verifyEmailSchema, mapZodErrors } from '@/validators/auth';
import {
  successResponse,
  error400,
  error404,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError, TokenExpiredError } from '@/lib/errors';

/**
 * POST /api/v1/auth/verify-email
 * Verifies a user's email address using the token sent by email.
 *
 * Body: { token: string }
 *
 * Responses:
 *   200 { data: { verified: true } }
 *   400 VALIDATION_FAILED — token missing from body
 *   400 TOKEN_EXPIRED     — token exists but is expired or already used
 *   404 NOT_FOUND         — token does not exist
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
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
    return successResponse({ verified: true }, 'Email verified successfully');
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      return error400('Verification token has expired or already been used', ApiCode.TOKEN_EXPIRED);
    }
    if (e instanceof NotFoundError) {
      return error404('Verification token not found', ApiCode.NOT_FOUND);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
