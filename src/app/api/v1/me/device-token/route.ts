/**
 * @swagger
 * /me/device-token:
 *   post:
 *     summary: Register or update the FCM push notification token
 *     description: >
 *       Upserts the Firebase Cloud Messaging (FCM) device token for the authenticated client.
 *       If the token already exists for this user it is kept as-is; a new token is inserted.
 *       Rate-limited to 10 requests per minute per user.
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - platform
 *             properties:
 *               token:
 *                 type: string
 *                 description: FCM registration token from the mobile or web app.
 *               platform:
 *                 type: string
 *                 enum: [android, ios, web]
 *                 description: The device platform.
 *     responses:
 *       200:
 *         description: Device token registered or confirmed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         token:
 *                           type: string
 *                         platform:
 *                           type: string
 *                           enum: [android, ios, web]
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
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
import type { NextResponse } from 'next/server';

import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error429, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { mapZodErrors } from '@/validators/shared';
import { registerDeviceTokenBodySchema } from '@/validators/device-token';
import { upsertDeviceToken } from '@/server/notifications/device-token-service';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';

// SECURITY: rate-limit device token registration to 10 per minute per user
const deviceTokenLimiter = createEndpointRateLimiter({ maxRequests: 10, windowMs: 60_000 });


// %%%%% POST Handler %%%%%
// Register or update device token for authenticated client

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  if (deviceTokenLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(
      error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)
    );
  }

  const parsed = registerDeviceTokenBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  const { token, platform } = parsed.data;

  try {
    await upsertDeviceToken(auth.sub, token, platform);
    return applyNoStoreHeaders(
      successResponse({ token, platform })
    );
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    console.error('[POST /api/v1/me/device-token] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
