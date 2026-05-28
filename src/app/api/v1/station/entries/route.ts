/**
 * GET  /api/v1/station/entries - list all entries for the station (paginated). Auth: station.
 * POST /api/v1/station/entries - create a walk-in entry (no Stripe payment). Auth: station.
 *
 * GET query params: status, from (ISO date), to (ISO date), page, per_page
 * POST body: { vehicle_format_id: UUID, service_id?: UUID, time_slot_id?: UUID }
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { listEntriesQuerySchema, mapZodErrors } from '@/validators/entry';
import { findStationByUserId } from '@/server/station/station-repository';
import { listRichStationEntries, createWalkInEntry } from '@/server/reservations/reservation-service';
import { serializeRichStationEntry, serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const walkInBodySchema = z.object({
  vehicle_format_id: z.string().uuid('Invalid vehicle_format_id'),
  /* Optional: when provided, the entry is snapshooted with the picked
   * station service so card titles can show the merchant-set name
   * (Lavage Premium…) instead of the bare vehicle format. */
  service_id: z.string().uuid('Invalid service_id').optional(),
  time_slot_id: z.string().uuid('Invalid time_slot_id').optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  const { searchParams } = new URL(request.url);
  const queryParsed = listEntriesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(queryParsed.error))
    );
  }

  const { status, from, to, slot_from, slot_to, entry_type, page, per_page } = queryParsed.data;

  try {
    const result = await listRichStationEntries(station.id, {
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      slot_from: slot_from ? new Date(slot_from) : undefined,
      slot_to: slot_to ? new Date(slot_to) : undefined,
      entry_type,
      page,
      per_page,
    });
    return applyNoStoreHeaders(
      successResponse({
        entries: result.rows.map(serializeRichStationEntry),
        total: result.total,
        page: result.page,
        per_page: result.per_page,
      })
    );
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = walkInBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error)));
  }

  try {
    const entry = await createWalkInEntry(
      station.id,
      auth.sub, // station owner's user_id - used as walk-in placeholder for the FK-constrained user_id column
      parsed.data.vehicle_format_id,
      parsed.data.time_slot_id,
      parsed.data.service_id
    );
    return applyNoStoreHeaders(successResponse(serializeEntry(entry)));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
