import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { ApiCode } from '@/types/api-codes';
import { error400, error500, successResponse } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import { findStationById } from '@/server/station/station-repository';
import { buildStationQrPublicUrl, verifyQrToken } from '@/server/qr/qr-token-service';
import { buildPromotionReferralUrl, findCurrentPromotionForStation } from '@/server/station/station-promotion-service';
import { extractLocale } from '@/lib/email';
import { REFRESH_COOKIE_NAME } from '@/helpers/server-constants';

type Params = { params: Promise<{ id: string }> };

const QR_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const AUTH_ROLE_COOKIE_NAME = 'Hurryline_auth_role';

type ResolverLocale = 'fr' | 'en';
type ResolverResult = 'invalid_qr_fallback' | 'promo_register' | 'station_public' | 'station_unavailable_fallback';

function getResolverLocale(request: Request, localeParam: string | null): ResolverLocale {
  if (localeParam === 'fr' || localeParam === 'en') return localeParam;
  return extractLocale(request.headers.get('accept-language'));
}

function buildResolverPayload(destinationUrl: string, resolution: ResolverResult) {
  return successResponse({
    destination_url: destinationUrl,
    resolution,
  });
}

function buildStationsDirectoryUrl(origin: string, locale: ResolverLocale): string {
  return `${origin}/${locale}/stations`;
}

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const parsed = stationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error)));
  }

  const url = new URL(request.url);
  const qrToken = url.searchParams.get('qr_token');
  const version = url.searchParams.get('v');
  const locale = getResolverLocale(request, url.searchParams.get('locale'));
  const origin = url.origin;

  try {
    const station = await findStationById(parsed.data.id);
    if (!station || station.status !== 'active') {
      return applyNoStoreHeaders(buildResolverPayload(
        buildStationsDirectoryUrl(origin, locale),
        'station_unavailable_fallback',
      ));
    }

    const hasValidToken = typeof qrToken === 'string' && QR_TOKEN_PATTERN.test(qrToken) && version === '1';
    const qrValidation = hasValidToken
      ? verifyQrToken({ stationId: station.id, qrToken, version })
      : { isValid: false as const };

    const fallbackUrl = buildStationQrPublicUrl({
      origin,
      locale,
      stationId: station.id,
      includeQrContext: false,
    });

    if (!qrValidation.isValid || !qrToken || !version) {
      return applyNoStoreHeaders(buildResolverPayload(fallbackUrl, 'invalid_qr_fallback'));
    }

    const cookieStore = await cookies();
    // The httpOnly refresh token cookie is intentionally scoped to `/api/v1/auth`,
    // so QR resolver routes cannot rely on it alone to detect an existing session.
    const hasSession = cookieStore.has(REFRESH_COOKIE_NAME) || cookieStore.has(AUTH_ROLE_COOKIE_NAME);
    const promotion = await findCurrentPromotionForStation(station.id);

    if (promotion && !hasSession) {
      return applyNoStoreHeaders(buildResolverPayload(
        buildPromotionReferralUrl({
          origin,
          locale,
          refCode: promotion.ref_code,
        }),
        'promo_register',
      ));
    }

    return applyNoStoreHeaders(buildResolverPayload(
      buildStationQrPublicUrl({
        origin,
        locale,
        stationId: station.id,
        qrToken,
        version,
      }),
      'station_public',
    ));
  } catch (error) {
    return applyNoStoreHeaders(error500(error));
  }
}
