/**
 * GET /api/v1/station/entries
 * List all entries (reservations then queue) for the authenticated station. Auth: station.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error404, error500, fromAppError } from '@/lib/responses';
import { findStationByUserId } from '@/server/station/station-repository';
import { listEntriesByStation } from '@/server/reservations/entry-repository';
import { serializeStationEntry } from '@/server/reservations/entry-serializer';
import { AppError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  const auth = await requireRole('station');
  if (auth instanceof Response) return auth as NextResponse;

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  try {
    const entries = await listEntriesByStation(station.id);
    return successResponse(entries.map(serializeStationEntry));
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

