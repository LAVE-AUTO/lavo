import { getActiveCommissionRate } from '@/server/admin/platform-settings-service';

export type BookingSource = 'standard' | 'qr';

export type ReservationSplit = {
  bookingSource: BookingSource;
  commissionRate: string;
  commissionAmount: number;
  stationPayout: number;
};

/**
 * Parses a normalized rate string into a usable decimal number
 *
 * Reservation split calculations depend on persisted commission values that
 * should always remain in the 0..1 range. This helper validates that contract
 * before any financial math runs so misconfigured platform or promo rates fail fast.
 *
 * @param {string} rate - Decimal rate string such as `0.1400` or `1.0000`
 * @param {string} label - Human-readable label included in the thrown error message
 * @returns {number} Parsed decimal rate between 0 and 1 inclusive
 * @throws {Error} If the rate cannot be parsed or falls outside the 0..1 range
 *
 * @example
 * const value = parseRate('0.1400', 'commission rate');
 * console.log(value); // 0.14
 *
 * @example
 * const value = parseRate('1.0000', 'promotion reduction rate');
 * console.log(value); // 1
 *
 * @example
 * // parseRate('1.5', 'commission rate'); // Throws Error('Invalid commission rate configuration')
 */
function parseRate(rate: string, label: string): number {
  const parsed = parseFloat(rate);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Invalid ${label} configuration`);
  }
  return parsed;
}

/**
 * Normalizes a currency amount into integer cents
 *
 * Rounds the incoming amount to a deterministic two-decimal currency value
 * before converting it to cents. This avoids repeating floating-point cleanup
 * logic throughout reservation split calculations.
 *
 * @param {number} amount - Currency amount expressed in major units such as euros
 * @returns {number} Integer cents value rounded from the normalized two-decimal amount
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const cents = normalizeMoneyToCents(12.5);
 * console.log(cents); // 1250
 *
 * @example
 * const cents = normalizeMoneyToCents(12.345);
 * console.log(cents); // 1235
 *
 * @example
 * const cents = normalizeMoneyToCents(0);
 * console.log(cents); // 0
 */
function normalizeMoneyToCents(amount: number): number {
  // Enforce a deterministic 2-decimal monetary input contract before cents conversion.
  const normalized = Number(amount.toFixed(2));
  return Math.round(normalized * 100);
}

/**
 * Computes the final reservation split between platform and station
 *
 * Centralizes the financial math shared by QR bookings and standard bookings
 * so every reservation flow uses the same commission rules. QR bookings zero
 * out the platform commission entirely, while enrolled promotions reduce the
 * normal platform commission by the configured reduction percentage.
 *
 * @param {{ amountTotal: number; isQrBooking: boolean; promotionReductionRate?: string | null }} params - Financial context for the reservation
 * @param {number} params.amountTotal - Reservation total in major currency units before platform commission split
 * @param {boolean} params.isQrBooking - Whether the booking comes from the immediate QR booking flow
 * @param {string | null} [params.promotionReductionRate=null] - Optional normalized decimal reduction rate such as `0.5000`
 * @returns {Promise<ReservationSplit>} Split object containing `bookingSource`, final `commissionRate`, `commissionAmount`, and `stationPayout`
 * @throws {Error} If the platform commission rate or promo reduction rate is malformed
 *
 * @example
 * const split = await computeReservationSplit({
 *   amountTotal: 20,
 *   isQrBooking: true,
 * });
 *
 * @example
 * const split = await computeReservationSplit({
 *   amountTotal: 20,
 *   isQrBooking: false,
 *   promotionReductionRate: '0.5000',
 * });
 *
 * @example
 * const split = await computeReservationSplit({
 *   amountTotal: 20,
 *   isQrBooking: false,
 * });
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
