/**
 * POST /api/v1/station/formats
 * Creates a global vehicle format. Auth STATION (admin-managed in production).
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { createFormat } from '@/server/station/format-service';
import { createFormatBodySchema, mapZodErrors } from '@/validators/station';
import { AppError } from '@/lib/errors';
import { serializeFormat } from '@/server/station/serializers';
import type { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
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
    const format = await createFormat({
      label: parsed.data.label,
      price: parsed.data.price,
      is_active: parsed.data.is_active,
    });
    return successResponse(serializeFormat(format), undefined, 201);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
