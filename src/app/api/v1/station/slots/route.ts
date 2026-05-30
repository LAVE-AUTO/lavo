/**
 * GET /api/v1/station/slots
 * Lists slots for the station on a given date with dynamic availability.
 * Auth STATION. Query: date (YYYY-MM-DD, optional - defaults to today).
 *
 * POST /api/v1/station/slots
 * Creates a single time slot. Auth STATION. Body: start_time, end_time, capacity.
 *
 * DELETE /api/v1/station/slots
 * Deletes slots by ids. Auth STATION. Body: { ids: string[] }. Skips slots with reservations.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { createSlot, deleteSlot } from '@/server/station/slot-service';
import { getStationSlotAvailability } from '@/server/station/availability-service';
import { createSlotBodySchema, deleteSlotsBodySchema, mapZodErrors } from '@/validators/station';
import { AppError, NotFoundError, ConflictError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date') ?? undefined;

  if (dateParam !== undefined && !DATE_REGEX.test(dateParam)) {
    return error400('date must be in YYYY-MM-DD format', ApiCode.VALIDATION_FAILED);
  }

  try {
    const slots = await getStationSlotAvailability(station.id, dateParam);
    return successResponse({ slots });
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = deleteSlotsBodySchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  const deleted: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];
  for (const id of parsed.data.ids) {
    try {
      await deleteSlot(station.id, id);
      deleted.push(id);
    } catch (e) {
      const reason =
        e instanceof NotFoundError || e instanceof ConflictError
          ? e.message
          : 'Delete failed';
      failed.push({ id, reason });
    }
  }
  return successResponse({ deleted, failed: failed.length > 0 ? failed : undefined });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = createSlotBodySchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  try {
    const slot = await createSlot(
      station.id,
      new Date(parsed.data.start_time),
      new Date(parsed.data.end_time),
      parsed.data.capacity
    );
    return successResponse(
      {
        id: slot.id,
        station_id: slot.station_id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        capacity: slot.capacity,
        booked_count: slot.booked_count,
        status: slot.status,
      },
      undefined,
      201
    );
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
