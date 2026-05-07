/**
 * POST /api/v1/station/extra-time
 *
 * Records extra time for a reservation currently in progress and cascades the delay
 * to all subsequent slots on the same station day.
 *
 * Auth: STATION
 *
 * Body:
 *   reservation_id: UUID   - the reservation that is overrunning
 *   extra_minutes: integer  - positive number of extra minutes to add
 *
 * Success 200:
 *   { data: { reservation_id, extra_minutes, shifted_slots, notified_clients } }
 *
 * Errors:
 *   400 VALIDATION_FAILED   - invalid body
 *   403 FORBIDDEN           - no station linked to this account
 *   404 NOT_FOUND           - reservation or slot not found
 *   409 CONFLICT            - reservation not in an overrunnable state
 *   500 INTERNAL_ERROR      - unexpected failure
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error403, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { addExtraTime } from '@/server/reservations/extra-time-service';
import { extraTimeBodySchema, mapZodErrors } from '@/validators/entry';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  const station = await findStationByUserId(auth.sub);
  if (!station) return error403('No station associated with this account', ApiCode.FORBIDDEN);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = extraTimeBodySchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const result = await addExtraTime(
      parsed.data.reservation_id,
      station.id,
      parsed.data.extra_minutes
    );
    return successResponse(result);
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
