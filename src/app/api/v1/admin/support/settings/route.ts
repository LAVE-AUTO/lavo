import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { mapZodErrors } from '@/validators/auth';
import { updateSupportSettingsSchema } from '@/validators/support';
import { getSupportSettings, updateSupportSettings } from '@/server/support/support-ticket-service';
import { AppError } from '@/lib/errors';
import { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/support/settings
 * Retrieves global support settings (Super Admin).
 */
export async function GET(request: Request) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof NextResponse) return auth;

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
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = updateSupportSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return error400('Validation failed', undefined, mapZodErrors(parsed.error));
    }

    await updateSupportSettings(parsed.data);
    return successResponse(null, 'Support settings updated');
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
