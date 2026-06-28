/**
 * GET /api/v1/station/promotion
 * Returns the authenticated station's currently active admin-created promotion
 * (or null when none is running) so the merchant dashboard / QR page can surface
 * a "promotion in progress" banner with a shareable referral link. Auth: station.
 *
 * Responses:
 *   200 { data: { active, ref_code, referral_url, commission_rate_percent, expires_at } }
 *   404 NOT_FOUND - no station for this account
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error404, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { extractLocale } from '@/lib/email';
import { findStationByUserId } from '@/server/station/station-repository';
import {
  findCurrentPromotionForStation,
  buildPromotionReferralUrl,
} from '@/server/station/station-promotion-service';
import type { NextResponse } from 'next/server';

function toPercent(rate: string | null | undefined): number | null {
  if (rate == null) return null;
  const parsed = parseFloat(rate);
  return Number.isFinite(parsed) ? Number((parsed * 100).toFixed(1)) : null;
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const station = await findStationByUserId(auth.sub);
    if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

    const promotion = await findCurrentPromotionForStation(station.id);
    if (!promotion) {
      return applyNoStoreHeaders(successResponse({ active: false }));
    }

    const locale = extractLocale(request.headers.get('accept-language'));
    const referralUrl = buildPromotionReferralUrl({
      origin: new URL(request.url).origin,
      locale,
      refCode: promotion.ref_code,
    });

    return applyNoStoreHeaders(
      successResponse({
        active: true,
        ref_code: promotion.ref_code,
        referral_url: referralUrl,
        commission_rate_percent: toPercent(promotion.commission_rate),
        expires_at: promotion.expires_at,
      }),
    );
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
