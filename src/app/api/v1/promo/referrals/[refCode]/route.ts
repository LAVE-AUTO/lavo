import { successResponse, error400, error404, error500 } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationById } from '@/server/station/station-repository';
import { resolvePromotionByRefCode } from '@/server/station/station-promotion-service';
import { NextResponse } from 'next/server';

const REF_CODE_PATTERN = /^[a-f0-9]{64}$/i;

type Params = { params: Promise<{ refCode: string }> };

/**
 * Converts a stored decimal commission rate into a public percentage
 *
 * Referral responses expose promo reductions as percentages even though the
 * database stores normalized decimal strings. This helper keeps that
 * translation consistent with the admin promo QR API.
 *
 * @param {string | null | undefined} rate - Persisted decimal rate string, or absent value when no promo exists
 * @returns {number | null} Percentage value rounded to one decimal place, or `null` when no rate is available
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const percent = toPercent('0.2500');
 * console.log(percent); // 25
 *
 * @example
 * const percent = toPercent(undefined);
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
 * Resolves a public promo referral code into station metadata
 *
 * Validates the referral code shape, loads the backing promotion, and ensures
 * the referenced station is still active before exposing any public details.
 * This endpoint feeds the signup experience that begins from a station QR scan.
 *
 * @param {Request} _request - Incoming request object, unused by the handler logic
 * @param {Params} context - Route context whose promised params include the referral code
 * @param {Promise<{ refCode: string }>} context.params - Async route params with the referral code
 * @returns {Promise<NextResponse>} No-store success response with station and promo metadata, or an error response
 * @throws {None} Infrastructure and lookup errors are converted into HTTP responses
 *
 * @example
 * const response = await GET(new Request('https://app.example.com'), {
 *   params: Promise.resolve({ refCode: 'abc123' }),
 * });
 *
 * @example
 * const response = await GET(new Request('https://app.example.com'), {
 *   params: Promise.resolve({ refCode: 'invalid' }),
 * });
 *
 * @example
 * const response = await GET(new Request('https://app.example.com'), {
 *   params: Promise.resolve({ refCode: 'missing-code' }),
 * });
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
