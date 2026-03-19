/**
 * POST /api/v1/reservations/:id/confirm-presence
 * Client confirms presence before the service starts. Auth: client.
 * Sets client_confirmed = true on the reservation. Must be called before the late-detection
 * cron runs (slot start_time + late_tolerance_minutes) to avoid being moved to the walk-in queue.
 *
 * Response 200: { data: { entry } }
 * Errors: 400 VALIDATION_FAILED, 401 UNAUTHORIZED, 404 NOT_FOUND, 409 CONFLICT, 500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { reservationIdParamSchema, mapZodErrors } from '@/validators/entry';
import { confirmPresence } from '@/server/reservations/reservation-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole('client');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const parsed = reservationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const entry = await confirmPresence(parsed.data.id, auth.sub);
    return successResponse({ entry: serializeEntry(entry) });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
