/**
 * Admin platform settings API.
 *
 * GET  /api/v1/admin/settings  — retrieve all configured settings with audit metadata
 * PATCH /api/v1/admin/settings — bulk-update one or more settings (admin only)
 *
 * Authentication: requireRole(request, 'admin')
 * GET response: array of 14 whitelisted setting keys with value, updated_at, and updated_by metadata
 * PATCH input: Record<AllowedKey, string> with 1–14 keys; validated via updatePlatformSettingsSchema
 * PATCH output: 200 success or error response with validation details
 */
import { requireRole } from '@/lib/require-role';
import {
  successResponse,
  error400,
  error500,
  fromAppError,
} from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import {
  updatePlatformSettingsSchema,
  mapZodErrors,
} from '@/validators/platform-settings';
import {
  getAllPlatformSettings,
  updatePlatformSettings,
} from '@/server/admin/platform-settings-service';
import type { NextResponse } from 'next/server';


// %%%%% GET handler %%%%%
// Retrieve all platform settings with audit metadata

/**
 * GET /api/v1/admin/settings
 *
 * Returns all configured whitelisted platform settings with their values,
 * last update timestamp, and audit information (who changed it).
 *
 * Responses:
 *   200 { data: PlatformSettingRow[] } - array of settings
 *   401 UNAUTHORIZED - admin auth required
 *   500 INTERNAL_ERROR - database or service error
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const rows = await getAllPlatformSettings();
    return applyNoStoreHeaders(successResponse(rows));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}


// %%%%% PATCH handler %%%%%
// Bulk-update one or more platform settings

/**
 * PATCH /api/v1/admin/settings
 *
 * Bulk-upserts one or more platform settings.
 *
 * Request body: Record<AllowedKey, string>
 *   - At least 1 key required; maximum 14 per request
 *   - Each key must be in ALLOWED_PLATFORM_SETTING_KEYS
 *   - Per-key semantic validation (ranges, types, cross-key constraints)
 *
 * Responses:
 *   200 { data: {}, message: "Platform settings updated" } - success
 *   400 VALIDATION_FAILED - invalid keys, ranges, or cross-key constraints
 *   400 Invalid JSON body - malformed request body
 *   401 UNAUTHORIZED - admin auth required
 *   500 INTERNAL_ERROR - database or service error
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  // Validate against schema
  const parsed = updatePlatformSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  // Upsert settings
  try {
    await updatePlatformSettings(parsed.data, auth.sub);
    return applyNoStoreHeaders(successResponse({}, 'Platform settings updated'));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
