/**
 * POST /api/v1/stations/onboarding/validate/step2
 * Validates step 2 fields (station details) without writing to the database.
 * The frontend uses this to gate progression to step 3.
 *
 * Body: { station_name, legal_name?, registration_number?, address, city,
 *         latitude?, longitude?, wash_post_count, wash_type_ids: string[] (min 1 UUID), description? }
 *
 * Responses:
 *   200 { message }
 *   400 VALIDATION_FAILED
 */
import { successResponse, error400 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { stationInfoSchema, mapZodErrors } from '@/validators/station';

export async function POST(request: Request) {
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

  return successResponse(null, 'Step 2 is valid.');
}
