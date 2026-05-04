/**
 * POST /api/v1/station/slots/:id/block
 * Blocks a time slot (sets status to 'blocked'). Auth: station.
 *
 * Responses:
 *   200 { data: TimeSlot }
 *   400 VALIDATION_FAILED
 *   404 NOT_FOUND
 *   409 CONFLICT — slot has active reservations
 *   500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { blockSlot } from '@/server/station/slot-service';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const paramSchema = z.object({ id: z.string().uuid('Invalid slot id') });

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id } = await params;
  const paramParsed = paramSchema.safeParse({ id });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(error400('Invalid slot id', ApiCode.VALIDATION_FAILED));
  }

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const slot = await blockSlot(station.id, paramParsed.data.id);
    return applyNoStoreHeaders(successResponse(slot));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ConflictError) return applyNoStoreHeaders(error409(e.message, ApiCode.CONFLICT));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
