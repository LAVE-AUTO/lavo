/**
 * PUT /api/v1/station/slots/replace
 * Atomically deletes the specified slots and creates a new set in one DB transaction.
 * If any delete is blocked (slot not found, not owned, has reservations) the whole
 * operation is rolled back and no data changes — no orphan slots.
 *
 * Body: { ids_to_delete: string[], slots: [{ start_time, end_time, capacity }] }
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { replaceSlots } from '@/server/station/slot-service';
import { replaceSlotsBodySchema, mapZodErrors } from '@/validators/station';
import { AppError, NotFoundError, ConflictError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function PUT(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = replaceSlotsBodySchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  try {
    const created = await replaceSlots(
      station.id,
      parsed.data.ids_to_delete,
      parsed.data.slots.map((s) => ({
        start_time: new Date(s.start_time),
        end_time: new Date(s.end_time),
        capacity: s.capacity,
      }))
    );

    return successResponse(
      created.map((slot) => ({
        id: slot.id,
        station_id: slot.station_id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        capacity: slot.capacity,
        booked_count: slot.booked_count,
        status: slot.status,
      })),
      undefined,
      200
    );
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
