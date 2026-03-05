/**
 * POST /api/v1/stations/onboarding/validate/step1
 * Validates step 1 fields (credentials) without writing to the database.
 * The frontend uses this to gate progression to step 2.
 *
 * Body: { email, phone, password, confirm_password }
 *
 * Responses:
 *   200 { message }
 *   400 VALIDATION_FAILED
 */
import { successResponse, error400 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { registerStationSchema, mapZodErrors } from '@/validators/station';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = registerStationSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  return successResponse(null, 'Step 1 is valid.');
}
