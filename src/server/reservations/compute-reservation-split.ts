import { getActiveCommissionRate } from '@/server/admin/platform-settings-service';
import { isStationCommissionExempt } from '@/server/admin/subscription-service';

export type BookingSource = 'standard' | 'qr';

export type ReservationSplit = {
  bookingSource: BookingSource;
  commissionRate: string;
  commissionAmount: number;
  stationPayout: number;
};

function normalizeMoneyToCents(amount: number): number {
  // Enforce a deterministic 2-decimal monetary input contract before cents conversion.
  const normalized = Number(amount.toFixed(2));
  return Math.round(normalized * 100);
}

/**
 * Centralizes reservation financial math to avoid duplicated logic across flows.
 * `amountTotal` is expected to represent a currency amount and is normalized to
 * 2 decimals before any cents-based computation.
 */
export async function computeReservationSplit(params: {
  stationId: string;
  amountTotal: number;
  isQrBooking: boolean;
}): Promise<ReservationSplit> {
  const { stationId, amountTotal, isQrBooking } = params;
  const totalCents = normalizeMoneyToCents(amountTotal);

  if (isQrBooking) {
    return {
      bookingSource: 'qr',
      commissionRate: '0.0000',
      commissionAmount: 0,
      stationPayout: totalCents / 100,
    };
  }

  /* Subscription stations pay a flat plan instead of a per-transaction cut, so
   * the platform takes no commission and the station receives the full amount.
   * Only exempt stations with an actually active subscription — a station set
   * to 'subscription' that never paid still owes commission. */
  if (await isStationCommissionExempt(stationId)) {
    return {
      bookingSource: 'standard',
      commissionRate: '0.0000',
      commissionAmount: 0,
      stationPayout: totalCents / 100,
    };
  }

  const commissionRate = await getActiveCommissionRate();
  const commissionRateNumber = parseFloat(commissionRate);
  if (!Number.isFinite(commissionRateNumber) || commissionRateNumber < 0 || commissionRateNumber > 1) {
    throw new Error('Invalid commission rate configuration');
  }
  const commissionCents = Math.round(totalCents * commissionRateNumber);
  const commissionAmount = commissionCents / 100;
  const stationPayout = (totalCents - commissionCents) / 100;

  return {
    bookingSource: 'standard',
    commissionRate,
    commissionAmount,
    stationPayout,
  };
}
