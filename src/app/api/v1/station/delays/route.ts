/**
 * GET /api/v1/station/delays
 * List delay requests for the authenticated station, with optional status filter and pagination.
 * Auth: station.
 *
 * Query params:
 *   status   — pending | accepted | refused | all (default: all)
 *   page     — page number (default: 1)
 *   per_page — items per page, max 100 (default: 20)
 */
import { z } from 'zod';
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { listDelaysByStation } from '@/server/reservations/delay-service';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

const listDelaysQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'refused', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  const { searchParams } = new URL(request.url);
  const parsed = listDelaysQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    const errors = parsed.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED, errors));
  }

  const { status, page, per_page } = parsed.data;

  try {
    const result = await listDelaysByStation(station.id, {
      status,
      page,
      perPage: per_page,
    });

    return applyNoStoreHeaders(
      successResponse({
        items: result.rows.map((r) => ({
          id: r.id,
          reservation_id: r.reservation_id,
          user_id: r.user_id,
          station_id: r.station_id,
          status: r.status,
          message: r.message,
          refusal_reason: r.refusal_reason,
          created_at: r.created_at,
          updated_at: r.updated_at,
          reservation: r.reservation
            ? {
                id: r.reservation.id,
                scheduled_at: r.reservation.scheduled_at,
                vehicle_format_id: r.reservation.vehicle_format_id,
              }
            : null,
        })),
        meta: {
          total: result.total,
          page: result.page,
          per_page: result.perPage,
        },
      })
    );
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
