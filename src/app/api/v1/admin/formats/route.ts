/**
 * GET  /api/v1/admin/formats — list the global vehicle format catalog. Auth: admin.
 * POST /api/v1/admin/formats — create a global vehicle format. Auth: admin.
 *
 * Vehicle formats are owned by the admin: stations only select from this
 * catalog when building their services. Uniqueness is case-insensitive
 * (normalized label), so the same format cannot be added twice.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { getAllFormats, createFormat } from '@/server/station/format-service';
import { mapZodErrors } from '@/validators/station';
import { AppError } from '@/lib/errors';
import { serializeFormat } from '@/server/station/serializers';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

/**
 * The admin adds the shared format catalog by LABEL only — no base price.
 * Each station later sets its own base price per service (service_vehicle_entries).
 */
const createAdminFormatSchema = z.object({
  label: z.string().min(1).max(100),
  is_active: z.boolean().optional().default(true),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  try {
    const formats = await getAllFormats();
    return successResponse({ items: formats.map(serializeFormat) });
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = createAdminFormatSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const format = await createFormat({
      label: parsed.data.label,
      // Base price is set per-station per-service; the shared catalog stores 0.
      price: 0,
      is_active: parsed.data.is_active,
    });
    return successResponse(serializeFormat(format), undefined, 201);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
