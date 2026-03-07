/**
 * POST /api/v1/station/formats
 * Creates a vehicle format for the authenticated station. Auth STATION.
 * Body: label (1–100 chars), price (> 0), is_active (optional, default true).
 * Returns 201 with created format.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { createFormat } from '@/server/station/format-service';
import { createFormatBodySchema, mapZodErrors } from '@/validators/station';
import { AppError, NotFoundError } from '@/lib/errors';
import { serializeFormat } from '@/server/station/serializers';
import type { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole('station');
  if (auth instanceof Response) return auth as NextResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = createFormatBodySchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const format = await createFormat(auth.sub, {
      label: parsed.data.label,
      price: parsed.data.price,
      is_active: parsed.data.is_active,
    });
    return successResponse(serializeFormat(format), undefined, 201);
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
