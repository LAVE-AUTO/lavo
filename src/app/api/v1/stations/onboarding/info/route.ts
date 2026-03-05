import { requireAuth } from '@/lib/require-auth';
import { submitStationInfo } from '@/server/station/station-service';
import { stationInfoSchema, mapZodErrors } from '@/validators/station';
import {
  successResponse,
  error400,
  error403,
  error409,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, ConflictError, ForbiddenError } from '@/lib/errors';
import { HTTP_STATUS } from '@/helpers/constants';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/stations/onboarding/info
 * Step 2 — Submit station details.
 * Requires authentication as a station account (status = pending_verification or active).
 *
 * Body: { station_name, legal_name?, registration_number?, address, city,
 *         latitude?, longitude?, wash_post_count, wash_type, description? }
 *
 * Responses:
 *   201 { message, data: Station }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN — not a station account
 *   409 CONFLICT — info already submitted
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth as NextResponse;

  if (auth.role !== 'station') {
    return error403('Only station accounts can access this endpoint');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = stationInfoSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const station = await submitStationInfo(auth.sub, parsed.data);
    return successResponse(station, 'Station information saved successfully.', HTTP_STATUS.CREATED);
  } catch (e) {
    if (e instanceof ConflictError) {
      return error409(e.message);
    }
    if (e instanceof ForbiddenError) {
      return error403(e.message);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
