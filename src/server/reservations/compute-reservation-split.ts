import { getActiveCommissionRate } from '@/server/admin/platform-settings-service';

export type BookingSource = 'standard' | 'qr';

export type ReservationSplit = {
  bookingSource: BookingSource;
  commissionRate: string;
  commissionAmount: number;
  stationPayout: number;
};

function parseRate(rate: string, label: string): number {
  const parsed = parseFloat(rate);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Invalid ${label} configuration`);
  }
  return parsed;
}

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
  amountTotal: number;
  isQrBooking: boolean;
  promotionReductionRate?: string | null;
}): Promise<ReservationSplit> {
  const { amountTotal, isQrBooking, promotionReductionRate = null } = params;
  const totalCents = normalizeMoneyToCents(amountTotal);

  if (isQrBooking) {
    return {
      bookingSource: 'qr',
      commissionRate: '0.0000',
      commissionAmount: 0,
      stationPayout: totalCents / 100,
    };
  }

  const commissionRate = await getActiveCommissionRate();
  const commissionRateNumber = parseRate(commissionRate, 'commission rate');

  if (promotionReductionRate != null) {
    const reductionRateNumber = parseRate(promotionReductionRate, 'promotion reduction rate');
    const effectiveCommissionRate = commissionRateNumber * (1 - reductionRateNumber);
    const effectiveCommissionRateString = effectiveCommissionRate.toFixed(4);
    const commissionCents = Math.round(totalCents * effectiveCommissionRate);
    const commissionAmount = commissionCents / 100;
    const stationPayout = (totalCents - commissionCents) / 100;

    return {
      bookingSource: 'standard',
      commissionRate: effectiveCommissionRateString,
      commissionAmount,
      stationPayout,
    };
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
