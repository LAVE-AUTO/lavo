import { headers } from 'next/headers';
import { registerStation } from '@/server/station/station-service';
import { registerStationSchema, mapZodErrors } from '@/validators/station';
import { checkRateLimit, recordFailedAttempt, resetOnSuccess } from '@/lib/rate-limiter';
import {
  successResponse,
  error400,
  error409,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, ConflictError } from '@/lib/errors';
import { HTTP_STATUS } from '@/helpers/constants';

/**
 * POST /api/v1/stations/register
 * Step 1 — Create a station user account.
 *
 * Body: { email, phone, password, confirm_password }
 *
 * Responses:
 *   201 { message, data: SafeUser }
 *   400 VALIDATION_FAILED
 *   409 EMAIL_ALREADY_EXISTS
 *   429 TOO_MANY_REQUESTS
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  const { blocked } = await checkRateLimit(ip);
  if (blocked) return error429();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = registerStationSchema.safeParse(body);
  if (!parsed.success) {
    await recordFailedAttempt(ip);
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const user = await registerStation({
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
    });

    await resetOnSuccess(ip);

    return successResponse(user, 'Station account created. Please verify your email.', HTTP_STATUS.CREATED);
  } catch (e) {
    if (e instanceof ConflictError) {
      return error409('Email already in use', ApiCode.EMAIL_ALREADY_EXISTS);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
