/**
 * POST /api/v1/station/slots/bulk
 * Creates multiple time slots. Auth STATION. Body: { slots: [{ start_time, end_time, capacity }] }.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { createSlotsBulk } from '@/server/station/slot-service';
import { createSlotsBulkBodySchema, mapZodErrors } from '@/validators/station';
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

  const parsed = createSlotsBulkBodySchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  try {
    const slots = await createSlotsBulk(
      station.id,
      parsed.data.slots.map((s) => ({
        start_time: new Date(s.start_time),
        end_time: new Date(s.end_time),
        capacity: s.capacity,
      }))
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
