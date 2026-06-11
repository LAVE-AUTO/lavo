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
