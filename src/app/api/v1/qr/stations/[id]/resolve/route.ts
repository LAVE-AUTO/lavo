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

/**
 * Resolves the locale used by the QR resolver response
 *
 * Prefers an explicit locale query parameter when the caller already knows the
 * intended language. When no explicit locale is present, it falls back to the
 * standard Accept-Language parsing used elsewhere in the app so redirects stay
 * consistent with the user's browser preferences.
 *
 * @param {Request} request - Incoming HTTP request containing the Accept-Language header
 * @param {string | null} localeParam - Optional locale query parameter from the resolver URL
 * @returns {ResolverLocale} Supported locale code restricted to `fr` or `en`
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const locale = getResolverLocale(request, 'fr');
 * console.log(locale); // 'fr'
 *
 * @example
 * const locale = getResolverLocale(request, null);
 *
 * @example
 * const locale = getResolverLocale(request, 'en');
 * console.log(locale === 'en');
 */
function getResolverLocale(request: Request, localeParam: string | null): ResolverLocale {
  if (localeParam === 'fr' || localeParam === 'en') return localeParam;
  return extractLocale(request.headers.get('accept-language'));
}

/**
 * Builds the success payload returned to the resolver page
 *
 * Wraps the chosen destination URL together with a machine-readable resolution
 * code so the client-side resolver page has a stable contract. The payload is
 * always returned inside the standard API success envelope used across the app.
 *
 * @param {string} destinationUrl - Absolute or app-relative URL that the client should open next
 * @param {ResolverResult} resolution - Resolution reason describing why this destination was chosen
 * @returns {ReturnType<typeof successResponse>} Standard success response envelope with resolver metadata
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const payload = buildResolverPayload('/fr/stations/abc', 'station_public');
 *
 * @example
 * const payload = buildResolverPayload('/fr/register?promo_ref_code=abc', 'promo_register');
 *
 * @example
 * const payload = buildResolverPayload('/en/stations', 'station_unavailable_fallback');
 */
function buildResolverPayload(destinationUrl: string, resolution: ResolverResult) {
  return successResponse({
    destination_url: destinationUrl,
    resolution,
  });
}

/**
 * Builds the generic stations directory fallback URL
 *
 * Uses the resolved locale to send users to the directory page when the target
 * station no longer exists or cannot accept QR traffic. This keeps failure
 * states user-friendly without leaking internal validation details.
 *
 * @param {string} origin - Absolute application origin such as `https://app.example.com`
 * @param {ResolverLocale} locale - Locale prefix to embed in the fallback path
 * @returns {string} Absolute localized stations directory URL
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const url = buildStationsDirectoryUrl('https://app.example.com', 'fr');
 *
 * @example
 * const url = buildStationsDirectoryUrl('https://app.example.com', 'en');
 *
 * @example
 * console.log(buildStationsDirectoryUrl('https://app.example.com', 'fr'));
 */
function buildStationsDirectoryUrl(origin: string, locale: ResolverLocale): string {
  return `${origin}/${locale}/stations`;
}

/**
 * Resolves a scanned station QR into its final public destination
 *
 * Validates the station id, checks the QR signature, detects whether the user
 * already has a session, and then chooses between promo registration and the
 * station public page. Invalid or unavailable QR targets are downgraded to
 * safe fallbacks rather than surfacing raw errors to the browser.
 *
 * @param {Request} request - Incoming resolver request containing QR query parameters and cookies
 * @param {Params} context - Route context whose promised params include the station id
 * @param {Promise<{ id: string }>} context.params - Async route params with the station UUID
 * @returns {Promise<NextResponse>} No-store API response containing the destination URL and resolution reason
 * @throws {None} All internal failures are converted into `error400` or `error500` responses
 *
 * @example
 * const response = await GET(request, {
 *   params: Promise.resolve({ id: 'station-123' }),
 * });
 *
 * @example
 * const response = await GET(requestWithPromoQr, {
 *   params: Promise.resolve({ id: 'station-123' }),
 * });
 *
 * @example
 * const response = await GET(requestWithInvalidQr, {
 *   params: Promise.resolve({ id: 'station-123' }),
 * });
 */
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
