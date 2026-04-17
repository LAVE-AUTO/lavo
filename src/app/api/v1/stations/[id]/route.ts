import type { NextResponse } from 'next/server';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError } from '@/lib/errors';
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import { getStationDetailPublic } from '@/server/station/station-service';

/**
 * GET /api/v1/stations/:id
 * Get a single active station with config, vehicle formats, and time slots.
 * Response includes available (boolean) and available_slots (number) from future slots.
 * Returns 404 if not found or station is not active.
 *
 * Response 200: { data: StationWithDetail & { available: boolean; available_slots: number; completed_count: number } }.
 * Responses: 400 VALIDATION_FAILED, 404 NOT_FOUND, 500 INTERNAL_ERROR.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const parsed = stationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }
  try {
    const station = await getStationDetailPublic(parsed.data.id);
    return successResponse(station);
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
