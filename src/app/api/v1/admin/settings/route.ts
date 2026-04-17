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
  error429,
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
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import type { NextResponse } from 'next/server';

// SECURITY: rate-limit settings mutations to 20 per minute per admin
const settingsPatchLimiter = createEndpointRateLimiter({ maxRequests: 20, windowMs: 60_000 });


// %%%%% GET handler %%%%%
// Retrieve all platform settings with audit metadata

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: Retrieve all platform settings (admin)
 *     description: >
 *       Returns all whitelisted platform settings with their values, last update
 *       timestamps, and the admin user who last changed each setting.
 *     tags:
 *       - Admin Settings
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All platform settings
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PlatformSettingRow'
 *       401:
 *         description: Unauthorized — admin auth required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *   patch:
 *     summary: Bulk-update platform settings (admin)
 *     description: >
 *       Upserts one or more platform settings. Each key must be in the platform allowlist.
 *       Per-key semantic validation is applied (ranges, types, cross-key constraints).
 *       Rate-limited to 20 requests per minute per admin.
 *     tags:
 *       - Admin Settings
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: >
 *               Map of setting keys to their new string values.
 *               At least 1 key required, maximum 15 per request.
 *             additionalProperties:
 *               type: string
 *             example:
 *               commission_rate_percent: "10"
 *               penalty_rate_percent: "5"
 *     responses:
 *       200:
 *         description: Platform settings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed — invalid keys, ranges, or cross-key constraints
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized — admin auth required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       429:
 *         description: Too many requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const rows = await getAllPlatformSettings();
    return applyNoStoreHeaders(successResponse(rows));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    // SECURITY: never pass the raw error to error500 — it leaks internal details via _dev in development mode
    console.error('[GET /api/v1/admin/settings] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
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
 *   - At least 1 key required; maximum 15 per request
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

  if (settingsPatchLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

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
    // SECURITY: never pass the raw error to error500 — it leaks internal details via _dev in development mode
    console.error('[PATCH /api/v1/admin/settings] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
