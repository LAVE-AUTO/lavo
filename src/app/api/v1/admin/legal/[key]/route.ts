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
 * GET /api/v1/admin/legal/:key
 *
 * Returns the stored content for the requested legal document key.
 * If the document has never been written, content is returned as null.
 *
 * Path parameters:
 *   key: cgu | politique_confidentialite | mentions_legales
 *
 * Responses:
 *   200 { data: { key: string, content: string | null } } - success
 *   400 VALIDATION_FAILED - key is not one of the supported values
 *   401 UNAUTHORIZED - admin auth required
 *   500 INTERNAL_ERROR - database or service error
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
    await updateLegalContent(key, content, auth.sub);
    // Re-read the stored (sanitized) content to return it in the response
    const stored = await getLegalContent(key);
    return applyNoStoreHeaders(successResponse({ key, content: stored }));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    // SECURITY: never expose raw error — it leaks internal details via _dev in development mode
    console.error(`[PATCH /api/v1/admin/legal/${key}] Unhandled error:`, e);
    return applyNoStoreHeaders(error500());
  }
}
