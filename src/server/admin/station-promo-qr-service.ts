import { ConflictError, NotFoundError } from '@/lib/errors';
import { sendStationPromotionEmail } from '@/lib/email';
import { findById as findUserById } from '@/server/auth/user-repository';
import { insertAdminLog } from './admin-log-repository';
import * as repo from './admin-user-repository';
import {
  buildCanonicalStationQrUrl,
  buildPromotionReferralUrl,
  createStationPromotionWithDeactivation,
  getLatestPromotionSnapshot,
} from '@/server/station/station-promotion-service';

type PromotionSnapshot = Awaited<ReturnType<typeof getLatestPromotionSnapshot>>;

/**
 * Builds the before/after payload stored in the admin audit log
 *
 * Narrows the full promotion rows down to the fields that matter for change
 * tracking so the admin log remains readable. The resulting object is used
 * only for observability and does not affect the promo generation workflow.
 *
 * @param {PromotionSnapshot} before - Latest known promotion snapshot before the update, or `null`/`undefined`
 * @param {PromotionSnapshot} after - Fresh promotion snapshot created by the current operation
 * @returns {{ before: object | null; after: object | null }} Audit diff payload containing only log-relevant promotion fields
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const diff = buildDiff(null, promotion);
 *
 * @example
 * const diff = buildDiff(previousPromotion, nextPromotion);
 * console.log(diff.after?.ref_code);
 *
 * @example
 * const diff = buildDiff(previousPromotion, null);
 * console.log(diff.before?.commission_rate ?? null);
 */
function buildDiff(before: PromotionSnapshot, after: PromotionSnapshot) {
  return {
    before: before ? {
      id: before.id,
      commission_rate: before.commission_rate,
      ref_code: before.ref_code,
      is_active: before.is_active,
      expires_at: before.expires_at,
      created_at: before.created_at,
    } : null,
    after: after ? {
      id: after.id,
      commission_rate: after.commission_rate,
      ref_code: after.ref_code,
      is_active: after.is_active,
      expires_at: after.expires_at,
      created_at: after.created_at,
    } : null,
  };
}

/**
 * Creates or replaces a station promo and returns the admin-facing payload
 *
 * This service coordinates station eligibility checks, promotion replacement,
 * QR/referral URL generation, admin audit logging, and the station notification
 * email side effect. It is the main orchestration entry point used by the
 * admin promo QR API route.
 *
 * @param {{ adminId: string; stationId: string; commissionRatePercent: number; expiresAt: Date; locale: 'fr' | 'en'; origin: string }} params - Promo upsert input bundle
 * @param {string} params.adminId - Admin UUID responsible for the change
 * @param {string} params.stationId - Station UUID receiving the promotion
 * @param {number} params.commissionRatePercent - Promo reduction percentage entered by the admin
 * @param {Date} params.expiresAt - Promotion expiration timestamp
 * @param {'fr' | 'en'} params.locale - Locale used when building the referral URL
 * @param {string} params.origin - Absolute application origin used to build returned URLs
 * @returns {Promise<{ station: repo.AdminStation; promotion: NonNullable<PromotionSnapshot>; qrUrl: string; referralUrl: string }>} Fresh station snapshot, created promotion row, canonical QR URL, and referral URL
 * @throws {NotFoundError} If the target station cannot be found before or after the update
 * @throws {ConflictError} If the station is not active and therefore cannot receive a promo QR
 * @throws {Error} Propagates repository, email, or database errors from downstream helpers
 *
 * @example
 * const result = await upsertStationPromoQr({
 *   adminId: 'admin-123',
 *   stationId: 'station-123',
 *   commissionRatePercent: 50,
 *   expiresAt: new Date('2026-07-01T23:59:59.999Z'),
 *   locale: 'fr',
 *   origin: 'https://app.example.com',
 * });
 *
 * @example
 * const result = await upsertStationPromoQr({
 *   adminId: 'admin-123',
 *   stationId: 'station-123',
 *   commissionRatePercent: 100,
 *   expiresAt: new Date('2026-06-30T23:59:59.999Z'),
 *   locale: 'en',
 *   origin: 'https://app.example.com',
 * });
 * console.log(result.qrUrl);
 *
 * @example
 * try {
 *   await upsertStationPromoQr({
 *     adminId: 'admin-123',
 *     stationId: 'missing-station',
 *     commissionRatePercent: 25,
 *     expiresAt: new Date('2026-07-01T23:59:59.999Z'),
 *     locale: 'fr',
 *     origin: 'https://app.example.com',
 *   });
 * } catch (error) {
 *   console.error(error);
 * }
 */
export async function upsertStationPromoQr(params: {
  adminId: string;
  stationId: string;
  commissionRatePercent: number;
  expiresAt: Date;
  locale: 'fr' | 'en';
  origin: string;
}): Promise<{
  station: repo.AdminStation;
  promotion: NonNullable<PromotionSnapshot>;
  qrUrl: string;
  referralUrl: string;
}> {
  const station = await repo.findStationForAdmin(params.stationId);
  if (!station) throw new NotFoundError('Station not found');
  if (station.status !== 'active') {
    throw new ConflictError('Promo QR is only available for active stations');
  }

  const before = await getLatestPromotionSnapshot(params.stationId);
  const promotion = await createStationPromotionWithDeactivation({
    adminId: params.adminId,
    stationId: params.stationId,
    commissionRatePercent: params.commissionRatePercent,
    expiresAt: params.expiresAt,
  });
  const afterStation = await repo.findStationForAdmin(params.stationId);
  if (!afterStation) throw new NotFoundError('Station not found');

  const qrUrl = buildCanonicalStationQrUrl({
    origin: params.origin,
    stationId: params.stationId,
  });
  const referralUrl = buildPromotionReferralUrl({
    origin: params.origin,
    locale: params.locale,
    refCode: promotion.ref_code,
  });

  insertAdminLog({
    admin_id: params.adminId,
    action: 'UPDATE_STATION_PROMO_QR',
    target_type: 'station',
    target_id: params.stationId,
    details: buildDiff(before, promotion),
  }).catch((err) => console.error('[admin-log] Failed to write promo QR audit log', err));

  if (afterStation.user_id) {
    const stationUser = await findUserById(afterStation.user_id);
    if (stationUser?.email) {
      sendStationPromotionEmail(
        stationUser.email,
        afterStation.name,
        'en',
        {
          qrPublicUrl: qrUrl,
          commissionRatePercent: params.commissionRatePercent,
          expiresAt: params.expiresAt,
        },
      ).catch((err) => console.error('[station-promotion-email] Failed to send promo email', err));
    }
  }

  return {
    station: afterStation,
    promotion,
    qrUrl,
    referralUrl,
  };
}
