/**
 * GET /api/v1/stations/:id/availability
 * Returns the list of available start times for a given date and service
 * duration, computed on the fly from station_hours / station_configs and the
 * existing reservations on each active wash bay (no overlaps).
 *
 * Public endpoint. The post assignment is done server-side at booking time
 * (POST /stations/:id/reservations) so we do not expose `post_id` here.
 *
 * Query:
 *   - date: YYYY-MM-DD (required)
 *   - duration_min: positive integer (required, ≤ 480)
 *   - OR service_id: UUID + vehicle_format_id?: UUID  → resolves duration server-side
 *
 * Responses:
 *   200 { data: { date, slots: [{ start_time, end_time }], closed_reason? } }
 *   400 VALIDATION_FAILED
 *   404 NOT_FOUND - station not found or not active
 *   500 INTERNAL_ERROR
 */
import { z } from 'zod';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import { isValidCalendarDate } from '@/helpers/date-helper';
import {
  computeAvailabilityForActiveStation,
} from '@/server/station/post-availability-service';
import {
  findServiceVehicleEntryForBooking,
  findServiceByIdAndStation,
} from '@/server/station/service-repository';
import { AppError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

const querySchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'date must be a valid calendar date' }),
    duration_min: z
      .string()
      .optional()
      .transform((s) => (s === '' || s === undefined ? undefined : parseInt(s, 10)))
      .refine(
        (n) => n === undefined || (Number.isInteger(n) && n >= 1 && n <= 480),
        { message: 'duration_min must be an integer between 1 and 480' }
      ),
    service_id: z.string().uuid('service_id must be a valid UUID').optional(),
    vehicle_format_id: z.string().uuid('vehicle_format_id must be a valid UUID').optional(),
  })
  .refine(
    (data) => data.duration_min !== undefined || data.service_id !== undefined,
    { message: 'Either duration_min or service_id must be provided' }
  );

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const paramParsed = stationIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }

  const { searchParams } = new URL(request.url);
  const queryParsed = querySchema.safeParse({
    date: searchParams.get('date') ?? undefined,
    duration_min: searchParams.get('duration_min') ?? undefined,
    service_id: searchParams.get('service_id') ?? undefined,
    vehicle_format_id: searchParams.get('vehicle_format_id') ?? undefined,
  });
  if (!queryParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(queryParsed.error));
  }

  try {
    /* Resolve duration: explicit duration_min wins; otherwise infer from
     * service_id + vehicle_format_id. */
    let durationMin = queryParsed.data.duration_min;
    if (durationMin === undefined && queryParsed.data.service_id) {
      const service = await findServiceByIdAndStation(queryParsed.data.service_id, paramParsed.data.id);
      if (!service) return error404('Service not found for this station');
      const entry = await findServiceVehicleEntryForBooking(
        queryParsed.data.service_id,
        queryParsed.data.vehicle_format_id ?? null
      );
      if (!entry) return error404('Service pricing entry not found for this format');
      durationMin = entry.duration_min ?? 30;
    }
    if (!durationMin) {
      return error400('Unable to resolve service duration', ApiCode.VALIDATION_FAILED);
    }

    const result = await computeAvailabilityForActiveStation({
      stationId: paramParsed.data.id,
      date: queryParsed.data.date,
      durationMin,
    });

    /* Strip post_id from the public payload — the server picks the bay at
     * booking time. We dedupe identical (start_time, end_time) pairs that
     * may come from different posts to give the client a clean list. */
    const seen = new Set<string>();
    const publicSlots: { start_time: string; end_time: string }[] = [];
    for (const s of result.slots) {
      const key = s.start_time;
      if (seen.has(key)) continue;
      seen.add(key);
      publicSlots.push({ start_time: s.start_time, end_time: s.end_time });
    }

    return successResponse({
      date: result.date,
      duration_min: durationMin,
      slots: publicSlots,
      ...(result.closed_reason ? { closed_reason: result.closed_reason } : {}),
    });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
