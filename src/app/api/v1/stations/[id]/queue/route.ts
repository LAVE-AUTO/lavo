/**
 * GET /api/v1/stations/:id/queue
 * List queue entries for the station. Can be public or auth; implemented as public for display.
 */
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import { listQueue } from '@/server/reservations/queue-service';
import { findStationById } from '@/server/station/station-repository';
import { AppError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const parsed = stationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }
  const station = await findStationById(parsed.data.id);
  if (!station || station.status !== 'active') return error404('Station not found or not active');

  try {
    const entries = await listQueue(parsed.data.id);
    return successResponse(entries.map(serializeEntry));
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

function serializeEntry(entry: {
  id: string;
  entry_type: string;
  station_id: string;
  vehicle_format_id: string;
  status: string;
  queue_position: number | null;
  amount_paid: string;
  created_at: Date;
}) {
  return {
    id: entry.id,
    entry_type: entry.entry_type,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    status: entry.status,
    queue_position: entry.queue_position,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
  };
}
