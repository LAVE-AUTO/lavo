/**
 * GET  /api/v1/station/hours - get 7-day opening hours for the station. Auth: station.
 * PATCH /api/v1/station/hours - upsert opening hours. Auth: station.
 *
 * PATCH body: { days: Array<{ day_of_week: 0-6, is_open: bool, morning_start?, morning_end?, afternoon_start?, afternoon_end? }> }
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { getStationHours, updateStationHours } from '@/server/station/station-hours-service';
import { findStationByUserId } from '@/server/station/station-repository';
import { AppError, ValidationError } from '@/lib/errors';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const hourPatchSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  is_open: z.boolean(),
  morning_start: z.string().regex(timePattern).nullable().optional(),
  morning_end: z.string().regex(timePattern).nullable().optional(),
  afternoon_start: z.string().regex(timePattern).nullable().optional(),
  afternoon_end: z.string().regex(timePattern).nullable().optional(),
});

const patchBodySchema = z.object({
  days: z.array(hourPatchSchema).min(1).max(7),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const hours = await getStationHours(station.id);
    return applyNoStoreHeaders(successResponse(hours));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const hours = await updateStationHours(station.id, parsed.data.days);
    return applyNoStoreHeaders(successResponse(hours));
  } catch (e) {
    if (e instanceof ValidationError) return applyNoStoreHeaders(error400(e.message, ApiCode.VALIDATION_FAILED));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
