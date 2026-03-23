/**
 * GET /api/v1/me/entries
 * List current user's entries (reservations and queue) with pagination and filters. Auth: client.
 *
 * Query params: status, from (ISO date), to (ISO date), page, per_page
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { listEntriesQuerySchema, mapZodErrors } from '@/validators/entry';
import { listMyEntries } from '@/server/reservations/reservation-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

  const { searchParams } = new URL(request.url);
  const queryParsed = listEntriesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(queryParsed.error));
  }

  const { status, from, to, page, per_page } = queryParsed.data;

  try {
    const result = await listMyEntries(auth.sub, {
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page,
      per_page,
    });
    return successResponse({
      entries: result.rows.map(serializeEntry),
      total: result.total,
      page: result.page,
      per_page: result.per_page,
    });
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
