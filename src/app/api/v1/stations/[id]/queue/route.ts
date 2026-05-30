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
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };
const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const parsed = stationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }
  const station = await findStationById(parsed.data.id);
  if (!station || station.status !== 'active') return error404('Station not found or not active');
  const { searchParams } = new URL(request.url);
  const query = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED);
  }

  try {
    const entries = await listQueue(parsed.data.id);
    const total = entries.length;
    const page = query.data.page;
    const per_page = query.data.per_page;
    const offset = (page - 1) * per_page;
    const paged = entries.slice(offset, offset + per_page);
    return successResponse({
      items: paged.map(serializeEntry),
      meta: {
        total,
        page,
        per_page,
        total_pages: Math.max(1, Math.ceil(total / per_page)),
      },
    });
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
  vehicle_format_id: string | null;
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
