/**
 * GET /api/v1/stations/:id/formats
 * Public. Returns vehicle formats for an active station. 404 if station not found or not active.
 * Response: { data: Array<{ id, station_id, label, price, is_active, created_at, updated_at }> }.
 */
import type { NextResponse } from 'next/server';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import { getFormatsByStationIdPublic } from '@/server/station/format-service';
import { AppError, NotFoundError } from '@/lib/errors';
import { serializeFormat } from '@/server/station/serializers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const parsed = stationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }
  try {
    const formats = await getFormatsByStationIdPublic(parsed.data.id);
    return successResponse(formats.map(serializeFormat));
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
