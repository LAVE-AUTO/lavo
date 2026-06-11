import { successResponse, error400, error404, error500 } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationById } from '@/server/station/station-repository';
import { resolvePromotionByRefCode } from '@/server/station/station-promotion-service';
import { NextResponse } from 'next/server';

const REF_CODE_PATTERN = /^[a-f0-9]{64}$/i;

type Params = { params: Promise<{ refCode: string }> };

function toPercent(rate: string | null | undefined): number | null {
  if (rate == null) return null;
  const parsed = parseFloat(rate);
  return Number.isFinite(parsed) ? Number((parsed * 100).toFixed(1)) : null;
}

/**
 * GET /api/v1/promo/referrals/:refCode
 * Resolves a promo referral code to its station metadata.
 */
export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const { refCode } = await params;
  if (!REF_CODE_PATTERN.test(refCode)) {
    return applyNoStoreHeaders(error400('Invalid referral code'));
  }

  try {
    const promotion = await resolvePromotionByRefCode(refCode);
    const station = promotion ? await findStationById(promotion.station_id) : undefined;
    if (!station || station.status !== 'active') {
      return applyNoStoreHeaders(error404('Promo referral not found'));
    }

    return applyNoStoreHeaders(successResponse({
      station_id: station.id,
      station_name: station.name,
      city: station.city,
      promo_ref_code: promotion!.ref_code,
      promo_commission_rate: promotion!.commission_rate,
      promo_commission_rate_percent: toPercent(promotion!.commission_rate),
      promo_ref_generated_at: promotion!.created_at,
    }));
  } catch (e) {
    return applyNoStoreHeaders(error500(e));
  }
}
