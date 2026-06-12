import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error429, error500, fromAppError } from '@/lib/responses';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';
import { extractLocale } from '@/lib/email';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import { adminStationIdParamSchema, updateStationPromoQrSchema, mapZodErrors } from '@/validators/station';
import { findStationForAdmin } from '@/server/admin/admin-user-repository';
import { upsertStationPromoQr } from '@/server/admin/station-promo-qr-service';
import {
  buildCanonicalStationQrUrl,
  buildPromotionReferralUrl,
  getLatestPromotionSnapshot,
  isPromotionCurrentlyValid,
} from '@/server/station/station-promotion-service';

const promoQrLimiter = createEndpointRateLimiter({ maxRequests: 20, windowMs: 60_000 });

type Params = { params: Promise<{ id: string }> };

/**
 * Converts a stored decimal commission rate into an admin-facing percentage
 *
 * Promotion rates are persisted as normalized decimals such as `0.5000`,
 * whereas the admin UI edits them as percentages such as `50`. This helper
 * performs that translation while preserving a single decimal place contract.
 *
 * @param {string | null | undefined} rate - Persisted decimal rate string, or absent value when no promo exists
 * @returns {number | null} Percentage value rounded to one decimal place, or `null` when no rate is available
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const percent = toPercent('0.5000');
 * console.log(percent); // 50
 *
 * @example
 * const percent = toPercent(null);
 * console.log(percent); // null
 *
 * @example
 * const percent = toPercent('1.0000');
 * console.log(percent); // 100
 */
function toPercent(rate: string | null | undefined): number | null {
  if (rate == null) return null;
  const parsed = parseFloat(rate);
  return Number.isFinite(parsed) ? Number((parsed * 100).toFixed(1)) : null;
}

/**
 * Builds the admin promo QR response payload for a station
 *
 * Aggregates the latest promotion snapshot, its derived percentage fields, the
 * canonical QR URL, and the referral URL expected by the admin UI. The helper
 * is shared by both GET and POST so both endpoints always return the same data shape.
 *
 * @param {Awaited<ReturnType<typeof findStationForAdmin>>} station - Admin station snapshot, or `null` when not found
 * @param {string} origin - Absolute application origin used to build returned URLs
 * @param {'fr' | 'en'} locale - Locale used when building the promo referral URL
 * @returns {Promise<{
 *   station_id: string;
 *   promo_commission_rate: string | null;
 *   promo_commission_rate_percent: number | null;
 *   promo_ref_code: string | null;
 *   promo_ref_generated_at: Date | null;
 *   promo_expires_at: Date | null;
 *   promo_is_active: boolean;
 *   qr_url: string;
 *   referral_url: string | null;
 * } | null>} Fully built response payload, or `null` when the station is absent
 * @throws {Error} Propagates repository or URL-builder errors from downstream helpers
 *
 * @example
 * const data = await buildResponseData(station, 'https://app.example.com', 'fr');
 *
 * @example
 * const data = await buildResponseData(station, 'https://app.example.com', 'en');
 * console.log(data?.promo_commission_rate_percent ?? null);
 *
 * @example
 * const data = await buildResponseData(null, 'https://app.example.com', 'fr');
 * console.log(data); // null
 */
async function buildResponseData(
  station: Awaited<ReturnType<typeof findStationForAdmin>>,
  origin: string,
  locale: 'fr' | 'en',
) {
  if (!station) return null;
  const promotion = await getLatestPromotionSnapshot(station.id);
  const promoCommissionRatePercent = promotion ? toPercent(promotion.commission_rate) : null;
  const referralUrl = promotion
    ? buildPromotionReferralUrl({ origin, locale, refCode: promotion.ref_code })
    : null;
  const qrUrl = buildCanonicalStationQrUrl({ origin, stationId: station.id });

  return {
    station_id: station.id,
    promo_commission_rate: promotion?.commission_rate ?? null,
    promo_commission_rate_percent: promoCommissionRatePercent,
    promo_ref_code: promotion?.ref_code ?? null,
    promo_ref_generated_at: promotion?.created_at ?? null,
    promo_expires_at: promotion?.expires_at ?? null,
    promo_is_active: promotion ? isPromotionCurrentlyValid(promotion) : false,
    qr_url: qrUrl,
    referral_url: referralUrl,
  };
}

/**
 * Returns the current promo QR configuration for an admin station view
 *
 * Validates admin access, loads the station, and returns the latest promo
 * snapshot together with the canonical QR URL and derived percentage fields.
 * The response is always marked no-store because promo state and QR metadata
 * can change between admin visits.
 *
 * @param {Request} request - Incoming authenticated admin request
 * @param {Params} context - Route context whose promised params include the station id
 * @param {Promise<{ id: string }>} context.params - Async route params with the station UUID
 * @returns {Promise<NextResponse>} No-store success response with promo QR metadata, or an error response
 * @throws {None} App and infrastructure errors are converted into HTTP responses
 *
 * @example
 * const response = await GET(request, {
 *   params: Promise.resolve({ id: 'station-123' }),
 * });
 *
 * @example
 * const response = await GET(adminRequest, {
 *   params: Promise.resolve({ id: 'station-123' }),
 * });
 *
 * @example
 * const response = await GET(adminRequest, {
 *   params: Promise.resolve({ id: 'bad-id' }),
 * });
 */
export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id } = await params;
  const parsed = adminStationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Invalid station id', undefined, mapZodErrors(parsed.error)));
  }

  try {
    const station = await findStationForAdmin(parsed.data.id);
    if (!station) return applyNoStoreHeaders(error404('Station not found'));

    const locale = extractLocale(request.headers.get('accept-language'));
    const data = await buildResponseData(station, new URL(request.url).origin, locale);
    return applyNoStoreHeaders(successResponse(data));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

/**
 * Creates or replaces a station promo QR configuration
 *
 * Enforces admin access, validates the request body, rate-limits repeated
 * regeneration attempts, and delegates the actual promo replacement to the
 * service layer. On success it returns the freshly created promotion snapshot
 * in the same shape as the read endpoint for UI simplicity.
 *
 * @param {Request} request - Incoming authenticated admin request containing the promo payload
 * @param {Params} context - Route context whose promised params include the station id
 * @param {Promise<{ id: string }>} context.params - Async route params with the station UUID
 * @returns {Promise<NextResponse>} No-store success response with the new promo QR metadata, or an error response
 * @throws {None} App and infrastructure errors are converted into HTTP responses
 *
 * @example
 * const response = await POST(request, {
 *   params: Promise.resolve({ id: 'station-123' }),
 * });
 *
 * @example
 * const response = await POST(adminRequest, {
 *   params: Promise.resolve({ id: 'station-123' }),
 * });
 *
 * @example
 * const response = await POST(adminRequest, {
 *   params: Promise.resolve({ id: 'bad-id' }),
 * });
 */
export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  if (promoQrLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

  const { id } = await params;
  const parsed = adminStationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Invalid station id', undefined, mapZodErrors(parsed.error)));
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body'));
  }

  const bodyParsed = updateStationPromoQrSchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return applyNoStoreHeaders(error400('Validation failed', undefined, mapZodErrors(bodyParsed.error)));
  }

  try {
    const locale = extractLocale(request.headers.get('accept-language'));
    const result = await upsertStationPromoQr({
      adminId: auth.sub,
      stationId: parsed.data.id,
      commissionRatePercent: bodyParsed.data.commission_rate_percent,
      expiresAt: new Date(bodyParsed.data.expires_at),
      locale,
      origin: new URL(request.url).origin,
    });

    return applyNoStoreHeaders(successResponse({
      station_id: result.station.id,
      promo_commission_rate: result.promotion.commission_rate,
      promo_commission_rate_percent: Number((bodyParsed.data.commission_rate_percent).toFixed(1)),
      promo_ref_code: result.promotion.ref_code,
      promo_ref_generated_at: result.promotion.created_at,
      promo_expires_at: result.promotion.expires_at,
      promo_is_active: true,
      qr_url: result.qrUrl,
      referral_url: result.referralUrl,
    }, 'Promo QR generated successfully'));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ConflictError) return applyNoStoreHeaders(error409(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
