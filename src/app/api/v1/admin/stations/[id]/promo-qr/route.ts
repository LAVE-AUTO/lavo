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

function toPercent(rate: string | null | undefined): number | null {
  if (rate == null) return null;
  const parsed = parseFloat(rate);
  return Number.isFinite(parsed) ? Number((parsed * 100).toFixed(1)) : null;
}

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
 * GET /api/v1/admin/stations/:id/promo-qr
 * Returns the current promo QR configuration for the station.
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
 * POST /api/v1/admin/stations/:id/promo-qr
 * Persists the promo QR settings and regenerates the reference code.
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
