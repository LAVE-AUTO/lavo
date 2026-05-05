/**
 * GET  /api/v1/station/hour-exceptions — list exception dates. Auth: station.
 * POST /api/v1/station/hour-exceptions — add an exception date. Auth: station.
 *
 * POST body: { exception_date: "YYYY-MM-DD", reason: string }
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { getStationHourExceptions, addStationHourException } from '@/server/station/station-hours-service';
import { findStationByUserId } from '@/server/station/station-repository';
import { AppError, ConflictError } from '@/lib/errors';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

/** Returns true when the YYYY-MM-DD string is a real calendar date (rejects 2025-13-45). */
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

const postBodySchema = z.object({
  exception_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'exception_date must be YYYY-MM-DD')
    .refine(isValidIsoDate, { message: 'exception_date is not a valid calendar date' }),
  reason: z.string().min(1).max(200),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const exceptions = await getStationHourExceptions(station.id);
    return applyNoStoreHeaders(successResponse(exceptions));
  } catch (e) {
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

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const exception = await addStationHourException(station.id, parsed.data.exception_date, parsed.data.reason);
    return applyNoStoreHeaders(successResponse(exception));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
