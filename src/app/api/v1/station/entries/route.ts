/**
 * GET /api/v1/station/entries
 * List all entries (reservations then queue) for the authenticated station. Auth: station.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error404, error500, fromAppError } from '@/lib/responses';
import { findStationByUserId } from '@/server/station/station-repository';
import { listEntriesByStation } from '@/server/reservations/entry-repository';
import { AppError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  const auth = await requireRole('station');
  if (auth instanceof Response) return auth as NextResponse;

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  try {
    const entries = await listEntriesByStation(station.id);
    return successResponse(entries.map(serializeEntry));
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

function serializeEntry(entry: {
  id: string;
  user_id: string;
  entry_type: string;
  time_slot_id: string | null;
  station_id: string;
  vehicle_format_id: string;
  status: string;
  queue_position: number | null;
  amount_paid: string;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}) {
  return {
    id: entry.id,
    user_id: entry.user_id,
    entry_type: entry.entry_type,
    time_slot_id: entry.time_slot_id,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    status: entry.status,
    queue_position: entry.queue_position,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    completed_at: entry.completed_at,
  };
}
