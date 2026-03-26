import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { mapZodErrors, updateSupportSettingsSchema } from '@/validators/support';
import { getSupportSettings, updateSupportSettings } from '@/server/support/support-ticket-service';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/support/settings
 * Retrieves global support settings (Super Admin).
 */
export async function GET(request: Request) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  try {
    const settings = await getSupportSettings();
    return successResponse(settings);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

/**
 * PATCH /api/v1/admin/support/settings
 * Updates global support settings (Super Admin).
 */
export async function PATCH(request: Request) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body');
  }

  const parsed = updateSupportSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', undefined, mapZodErrors(parsed.error));
  }

  try {
    await updateSupportSettings(parsed.data);
    return successResponse({}, 'Support settings updated');
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
