/**
 * GET /api/v1/stations/:id/formats
 * Public. Returns all global vehicle formats (station param kept for backward compatibility).
 */
import type { NextResponse } from 'next/server';
import { successResponse, error500, fromAppError } from '@/lib/responses';
import { getAllFormats } from '@/server/station/format-service';
import { AppError } from '@/lib/errors';
import { serializeFormat } from '@/server/station/serializers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, _ctx: Params): Promise<NextResponse> {
  try {
    const formats = await getAllFormats();
    return successResponse(formats.map(serializeFormat));
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
