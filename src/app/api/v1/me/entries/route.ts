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
import { listMyRichEntries } from '@/server/reservations/reservation-service';
import { serializeRichEntry } from '@/server/reservations/entry-serializer';
import { AppError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { searchParams } = new URL(request.url);
  const queryParsed = listEntriesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(queryParsed.error))
    );
  }

  const { status, from, to, page, per_page } = queryParsed.data;

  try {
    const result = await listMyRichEntries(auth.sub, {
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page,
      per_page,
    });
    return applyNoStoreHeaders(
      successResponse({
        entries: result.rows.map(serializeRichEntry),
        total: result.total,
        page: result.page,
        per_page: result.per_page,
      })
    );
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
