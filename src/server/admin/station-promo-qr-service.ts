import { ConflictError, NotFoundError } from '@/lib/errors';
import { insertAdminLog } from './admin-log-repository';
import * as repo from './admin-user-repository';
import {
  buildPromoReferralUrl,
  generatePromoRefCode,
  normalizePromoCommissionRatePercent,
} from '@/server/station/promo-qr-service';

function buildDiff<T>(before: T, after: T): { before: T; after: T } {
  return { before, after };
}

export async function upsertStationPromoQr(params: {
  adminId: string;
  stationId: string;
  commissionRatePercent: number;
  locale: 'fr' | 'en';
  origin: string;
}): Promise<{ station: repo.AdminStation; referralUrl: string }> {
  const before = await repo.findStationForAdmin(params.stationId);
  if (!before) throw new NotFoundError('Station not found');
  if (before.status !== 'active') {
    throw new ConflictError('Promo QR is only available for active stations');
  }

  const generatedAt = new Date();
  const refCode = generatePromoRefCode({
    stationId: params.stationId,
    commissionRatePercent: params.commissionRatePercent,
    generatedAt,
  });
  const commissionRate = normalizePromoCommissionRatePercent(params.commissionRatePercent);

  const after = await repo.updateStationPromoQrById(params.stationId, {
    promo_commission_rate: commissionRate.toFixed(4),
    promo_ref_code: refCode,
    promo_ref_generated_at: generatedAt,
  });
  if (!after) throw new NotFoundError('Station not found');

  insertAdminLog({
    admin_id: params.adminId,
    action: 'UPDATE_STATION_PROMO_QR',
    target_type: 'station',
    target_id: params.stationId,
    details: buildDiff(
      {
        promo_commission_rate: before.promo_commission_rate,
        promo_ref_code: before.promo_ref_code,
        promo_ref_generated_at: before.promo_ref_generated_at,
      },
      {
        promo_commission_rate: after.promo_commission_rate,
        promo_ref_code: after.promo_ref_code,
        promo_ref_generated_at: after.promo_ref_generated_at,
      }
    ),
  }).catch((err) => console.error('[admin-log] Failed to write promo QR audit log', err));

  return {
    station: after,
    referralUrl: buildPromoReferralUrl({
      origin: params.origin,
      locale: params.locale,
      refCode,
    }),
  };
}
