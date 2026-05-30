/**
 * POST /api/v1/station/queue/next
 *
 * Calls the next client in the walk-in queue (lowest queue_position, active status).
 * Sets the entry to in_progress, removes the client from the queue, shifts all remaining
 * positions up by 1, and sends push notifications:
 *   - The called client: "queue_pick" (it is your turn)
 *   - Remaining clients: "queue_position_changed" (position updated)
 *
 * Note: position-changed notifications for remaining clients are handled inside
 * pickQueueEntry via the existing shiftQueuePositions path. A separate broadcast
 * can be layered on top if real-time updates (WebSocket/SSE) are added later.
 *
 * Auth: STATION
 *
 * Success 200:
 *   { data: { entry } }
 *
 * Errors:
 *   403 FORBIDDEN    - no station linked to this account
 *   404 NOT_FOUND    - queue is empty (no active entries)
 *   409 CONFLICT     - entry not in a pickable state
 *   500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error403, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { callNextInQueue } from '@/server/reservations/queue-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  const station = await findStationByUserId(auth.sub);
  if (!station) return error403('No station associated with this account', ApiCode.FORBIDDEN);

  try {
    const entry = await callNextInQueue(station.id);
    return successResponse({ entry: serializeEntry(entry) });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
