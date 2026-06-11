import 'server-only';

import { buildPromoReferralUrl, generatePromoRefCode, normalizePromoCommissionRatePercent } from '@/server/station/promo-qr-service';
import {
  createStationPromotion,
  deactivateStationPromotions,
  findActiveStationPromotionByStationId,
  findLatestStationPromotionByStationId,
  findPromotionByUserAndStationIfCurrent,
  findStationPromotionByRefCode,
  createStationPromotionEnrollment,
  type StationPromotion,
} from './station-promotion-repository';
import { buildStationQrResolverUrl } from '@/server/qr/qr-token-service';

export type PromotionLocale = 'fr' | 'en';
export type PromotionSummary = Pick<StationPromotion, 'is_active' | 'expires_at'> | null | undefined;

export function isPromotionExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() < now.getTime();
}

export function isPromotionCurrentlyValid(
  promotion: PromotionSummary,
  now = new Date(),
): boolean {
  if (!promotion || !promotion.is_active) return false;
  return !isPromotionExpired(promotion.expires_at, now);
}

export async function findCurrentPromotionForStation(stationId: string, now = new Date()) {
  const promotion = await findActiveStationPromotionByStationId(stationId);
  if (!promotion || !isPromotionCurrentlyValid(promotion, now)) return null;
  return promotion;
}

export async function resolvePromotionByRefCode(refCode: string, now = new Date()) {
  const promotion = await findStationPromotionByRefCode(refCode);
  if (!promotion || !isPromotionCurrentlyValid(promotion, now)) return null;
  return promotion;
}

export async function createPromotionEnrollmentForUser(params: {
  userId: string;
  stationId: string;
  promotionId: string;
}) {
  return createStationPromotionEnrollment({
    user_id: params.userId,
    station_id: params.stationId,
    promotion_id: params.promotionId,
  });
}

export async function findApplicablePromotionForUserReservation(
  userId: string,
  stationId: string,
  now = new Date(),
) {
  return findPromotionByUserAndStationIfCurrent(userId, stationId, now);
}

export async function createStationPromotionWithDeactivation(params: {
  adminId: string;
  stationId: string;
  commissionRatePercent: number;
  expiresAt: Date;
}) {
  const now = new Date();
  const refCode = generatePromoRefCode({
    stationId: params.stationId,
    commissionRatePercent: params.commissionRatePercent,
    generatedAt: now,
  });
  const commissionRate = normalizePromoCommissionRatePercent(params.commissionRatePercent);

  await deactivateStationPromotions(params.stationId, now);

  return createStationPromotion({
    station_id: params.stationId,
    created_by_admin_id: params.adminId,
    commission_rate: commissionRate.toFixed(4),
    ref_code: refCode,
    is_active: true,
    expires_at: params.expiresAt,
  });
}

export function buildPromotionReferralUrl(params: {
  origin: string;
  locale: PromotionLocale;
  refCode: string;
}) {
  return buildPromoReferralUrl(params);
}

export function buildCanonicalStationQrUrl(params: {
  origin: string;
  stationId: string;
}) {
  return buildStationQrResolverUrl(params);
}

export async function getLatestPromotionSnapshot(stationId: string) {
  return findLatestStationPromotionByStationId(stationId);
}
