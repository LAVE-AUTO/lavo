/**
 * GET  /api/v1/station/hour-exceptions - list exception dates. Auth: station.
 * POST /api/v1/station/hour-exceptions - add an exception date. Auth: station.
 *
 * POST body: { exception_date: "YYYY-MM-DD", reason: string }
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { getStationHourExceptions, addStationHourException, serializeHourException } from '@/server/station/station-hours-service';
import { findStationByUserId } from '@/server/station/station-repository';
import { AppError } from '@/lib/errors';
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

/** HH:MM 24-hour clock. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const postBodySchema = z
  .object({
    exception_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'exception_date must be YYYY-MM-DD')
      .refine(isValidIsoDate, { message: 'exception_date is not a valid calendar date' }),
    reason: z.string().min(1).max(200),
    status: z.enum(['closed', 'open_all_day', 'open_custom']).optional().default('closed'),
    open_time: z.string().regex(TIME_RE, 'open_time must be HH:MM').nullable().optional(),
    close_time: z.string().regex(TIME_RE, 'close_time must be HH:MM').nullable().optional(),
  })
  .refine(
    (v) => v.status !== 'open_custom' || (!!v.open_time && !!v.close_time),
    { message: 'open_time and close_time are required for open_custom', path: ['open_time'] },
  );
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));
  const { searchParams } = new URL(request.url);
  const query = listQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const exceptions = await getStationHourExceptions(station.id);
    const total = exceptions.length;
    const page = query.data.page;
    const per_page = query.data.per_page;
    const offset = (page - 1) * per_page;
    const items = exceptions.slice(offset, offset + per_page).map(serializeHourException);
    return applyNoStoreHeaders(successResponse({
      items,
      meta: {
        total,
        page,
        per_page,
        total_pages: Math.max(1, Math.ceil(total / per_page)),
      },
    }));
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
    const exception = await addStationHourException(
      station.id,
      parsed.data.exception_date,
      parsed.data.reason,
      {
        status: parsed.data.status,
        open_time: parsed.data.open_time ?? null,
        close_time: parsed.data.close_time ?? null,
      },
    );
    return applyNoStoreHeaders(successResponse(serializeHourException(exception)));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
