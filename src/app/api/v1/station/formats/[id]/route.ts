/**
 * PUT  /api/v1/station/formats/:id — full update. Auth: admin.
 * PATCH /api/v1/station/formats/:id — partial update. Auth: admin.
 * DELETE /api/v1/station/formats/:id — delete if no reservations. Auth: admin.
 *
 * The vehicle format catalog is global and admin-owned (see /api/v1/admin/formats);
 * stations only select from it, they never mutate it.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { updateFormat, deleteFormat } from '@/server/station/format-service';
import { updateFormatBodySchema, patchFormatBodySchema, formatIdParamSchema, mapZodErrors } from '@/validators/station';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { serializeFormat } from '@/server/station/serializers';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const paramParsed = formatIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const bodyParsed = updateFormatBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
  }

  try {
    const format = await updateFormat(paramParsed.data.id, bodyParsed.data, false);
    return successResponse(serializeFormat(format));
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const paramParsed = formatIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const bodyParsed = patchFormatBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
  }

  try {
    const format = await updateFormat(paramParsed.data.id, bodyParsed.data, true);
    return successResponse(serializeFormat(format));
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const paramParsed = formatIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }

  try {
    await deleteFormat(paramParsed.data.id);
    return successResponse({ deleted: true });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
