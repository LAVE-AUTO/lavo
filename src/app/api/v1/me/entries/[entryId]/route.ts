/**
 * GET /api/v1/me/entries/:entryId
 * Returns a single entry for the authenticated client, enriched with station and vehicle format.
 * Auth: client.
 *
 * Params: entryId (entry UUID)
 *
 * Responses:
 *   200 { data: RichEntry }
 *   400 VALIDATION_FAILED
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { getMyRichEntry } from '@/server/reservations/reservation-service';
import { serializeRichEntry } from '@/server/reservations/entry-serializer';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const entryIdParamSchema = z.object({
  entryId: z.string().uuid('Invalid entry id'),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { entryId } = await params;
  const paramParsed = entryIdParamSchema.safeParse({ entryId });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid entry id', ApiCode.VALIDATION_FAILED)
    );
  }

  try {
    const entry = await getMyRichEntry(paramParsed.data.entryId, auth.sub);
    if (!entry) throw new NotFoundError('Entry not found');
    return applyNoStoreHeaders(successResponse(serializeRichEntry(entry)));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
