/**
 * Public read-only endpoint that returns the sanitized legal/landing
 * content for a given key. Used by the public pages (CGU, privacy,
 * mentions, contact, cancellation, FAQ, "how it works") so admin edits
 * via PATCH /admin/legal/:key are reflected without requiring an admin
 * session.
 *
 * The content is sanitized server-side before storage; what we return
 * here is what was persisted. Falls back to the bundled HTML default
 * when no admin override exists yet.
 */
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { AppError } from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import { legalKeyParamSchema } from '@/validators/legal-content';
import { mapZodErrors } from '@/validators/shared';
import { getLegalContent } from '@/server/admin/legal-content-service';
import type { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
): Promise<NextResponse> {
  const resolvedParams = await params;
  const parsed = legalKeyParamSchema.safeParse({ key: resolvedParams.key });
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid legal content key', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  const { key } = parsed.data;
  const localeParam = new URL(request.url).searchParams.get('locale');
  const locale: 'fr' | 'en' = localeParam === 'en' ? 'en' : 'fr';

  try {
    const content = await getLegalContent(key, { withDefault: true, locale });
    return applyNoStoreHeaders(successResponse({ key, content: content ?? '' }));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    console.error(`[GET /api/v1/legal/${key}] Unhandled error:`, e);
    return applyNoStoreHeaders(error500());
  }
}
