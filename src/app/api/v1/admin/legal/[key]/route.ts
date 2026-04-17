/**
 * Legal content API — per-key read and update.
 *
 * GET  /api/v1/admin/legal/:key  — retrieve the stored content for a legal document
 * PATCH /api/v1/admin/legal/:key — upsert (create or overwrite) a legal document
 *
 * Supported keys: cgu, politique_confidentialite, mentions_legales
 *
 * Authentication: requireRole(request, 'admin') — admin JWT required for both methods
 * Rate limiting: PATCH is limited to 20 requests per minute per admin
 * Sanitization: content is sanitized with DOMPurify before persistence (XSS prevention)
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
import { mapZodErrors } from '@/validators/shared';
import {
  legalKeyParamSchema,
  updateLegalContentBodySchema,
} from '@/validators/legal-content';
import {
  getLegalContent,
  updateLegalContent,
} from '@/server/admin/legal-content-service';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import type { NextResponse } from 'next/server';

// SECURITY: rate-limit legal content mutations to 20 per minute per admin
const legalPatchLimiter = createEndpointRateLimiter({ maxRequests: 20, windowMs: 60_000 });


// %%%%% GET handler %%%%%
// Retrieve legal content by key

/**
 * @swagger
 * /admin/legal/{key}:
 *   get:
 *     summary: Retrieve a legal document (admin)
 *     description: >
 *       Returns the stored HTML content for the given legal document key.
 *       Returns content as null if the document has never been written.
 *     tags:
 *       - Legal Content
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cgu, politique_confidentialite, mentions_legales]
 *     responses:
 *       200:
 *         description: Legal document content
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/LegalContent'
 *       400:
 *         description: Invalid legal document key
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *   patch:
 *     summary: Create or overwrite a legal document (admin)
 *     description: >
 *       Upserts the legal document for the given key. Content is sanitized
 *       server-side with DOMPurify before persistence.
 *       Rate-limited to 20 requests per minute per admin.
 *     tags:
 *       - Legal Content
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cgu, politique_confidentialite, mentions_legales]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100000
 *                 description: HTML content of the legal document.
 *     responses:
 *       200:
 *         description: Legal document updated with sanitized content
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/LegalContent'
 *       400:
 *         description: Validation failed — invalid key or body
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
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const resolvedParams = await params;
  const parsed = legalKeyParamSchema.safeParse({ key: resolvedParams.key });
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid legal content key', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  const { key } = parsed.data;

  try {
    const content = await getLegalContent(key);
    return applyNoStoreHeaders(successResponse({ key, content }));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    // SECURITY: never expose raw error — it leaks internal details via _dev in development mode
    console.error(`[GET /api/v1/admin/legal/${key}] Unhandled error:`, e);
    return applyNoStoreHeaders(error500());
  }
}


// %%%%% PATCH handler %%%%%
// Upsert legal content by key

/**
 * PATCH /api/v1/admin/legal/:key
 *
 * Creates or overwrites the legal document for the given key.
 * The content is sanitized server-side (DOMPurify) before storage.
 *
 * Path parameters:
 *   key: cgu | politique_confidentialite | mentions_legales
 *
 * Request body:
 *   { content: string }  — 1 to 100 000 characters, required
 *
 * Responses:
 *   200 { data: { key: string, content: string } } - success with sanitized content
 *   400 VALIDATION_FAILED - key not supported or body invalid
 *   400 Invalid JSON body - malformed request body
 *   401 UNAUTHORIZED - admin auth required
 *   429 TOO_MANY_REQUESTS - rate limit exceeded
 *   500 INTERNAL_ERROR - database or service error
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  if (legalPatchLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

  const resolvedParams = await params;
  const paramParsed = legalKeyParamSchema.safeParse({ key: resolvedParams.key });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid legal content key', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error))
    );
  }

  const { key } = paramParsed.data;

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  // Validate body
  const bodyParsed = updateLegalContentBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error))
    );
  }

  const { content } = bodyParsed.data;

  try {
    const sanitized = await updateLegalContent(key, content, auth.sub);
    return applyNoStoreHeaders(successResponse({ key, content: sanitized }));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    // SECURITY: never expose raw error — it leaks internal details via _dev in development mode
    console.error(`[PATCH /api/v1/admin/legal/${key}] Unhandled error:`, e);
    return applyNoStoreHeaders(error500());
  }
}
