import { headers } from 'next/headers';
import { completeStationOnboarding } from '@/server/station/station-service';
import { stationOnboardingSubmitSchema, mapZodErrors } from '@/validators/station';
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
 * POST /api/v1/stations/onboarding/submit
 * Final step — receives all onboarding data (steps 1, 2, 3) and performs all
 * DB operations atomically: creates the user account, the station record, and
 * the uploaded documents in a single transaction.
 *
 * No DB writes occur until this endpoint is called, so abandoning the form at
 * any earlier step leaves no orphaned records.
 *
 * Body: {
 *   // Step 1
 *   email, phone, password, confirm_password,
 *   // Step 2
 *   station_name, legal_name?, registration_number?, address, city,
 *   latitude?, longitude?, wash_post_count, wash_type_ids: string[] (min 1 UUID), description?,
 *   // Step 3
 *   documents: [{ document_type, file_url, storage?: 'cloudinary' | 'local' }], terms_accepted: true
 * }
 *
 * Responses:
 *   201 { message, data: { user: SafeUser, station: Station } }
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

  const parsed = stationOnboardingSubmitSchema.safeParse(body);
  if (!parsed.success) {
    await recordFailedAttempt(ip);
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  // confirm_password is for validation only — strip it before passing to the service
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip for service
  const { confirm_password: _, ...dto } = parsed.data;

  try {
    const result = await completeStationOnboarding(dto);

    await resetOnSuccess(ip);

    return successResponse(
      result,
      'Registration complete. Please verify your email.',
      HTTP_STATUS.CREATED
    );
  } catch (e) {
    if (e instanceof ConflictError) {
      return error409('Email already in use', ApiCode.EMAIL_ALREADY_EXISTS);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
