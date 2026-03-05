import { forgotPassword } from '@/server/auth/auth-service';
import { forgotPasswordSchema, mapZodErrors } from '@/validators/auth';
import { successResponse, error400, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';

/**
 * POST /api/v1/auth/forgot-password
 * Sends a password reset email if the account exists and is active.
 *
 * Body: { email: string }
 *
 * Responses:
 *   200 { data: { sent: true } }  — always, to prevent email enumeration
 *   400 VALIDATION_FAILED         — invalid email format
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
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

  try {
    await forgotPassword(parsed.data.email);
    return successResponse({ sent: true }, 'If an account exists, a reset email has been sent');
  } catch {
    return error500();
  }
}
