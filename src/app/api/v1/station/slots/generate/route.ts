/**
 * POST /api/v1/station/slots/generate
 * Generates time slots from station config for a date or date range. Auth STATION.
 * Body: { date (YYYY-MM-DD), end_date?, interval_minutes? }.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { generateAndPersistSlots } from '@/server/station/slot-service';
import { generateSlotsBodySchema, mapZodErrors } from '@/validators/station';
import { AppError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = generateSlotsBodySchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  try {
    const slots = await generateAndPersistSlots(
      station.id,
      parsed.data.date,
      parsed.data.end_date,
      parsed.data.interval_minutes
    );
    return successResponse(
      slots.map((slot) => ({
        id: slot.id,
        station_id: slot.station_id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        capacity: slot.capacity,
        booked_count: slot.booked_count,
        status: slot.status,
      })),
      undefined,
      201
    );
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
