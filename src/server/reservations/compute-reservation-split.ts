import {
  getActiveCommissionRate,
  getPlatformServiceFee,
} from '@/server/admin/platform-settings-service';

export type BookingSource = 'standard' | 'qr';

export type ReservationSplit = {
  bookingSource: BookingSource;
  commissionRate: string;
  commissionAmount: number;
  stationPayout: number;
  station_service_total: number;
  platform_service_fee: number;
  taxable_subtotal: number;
  tps_amount: number;
  tvq_amount: number;
  client_total: number;
  platform_subtotal: number;
  platform_tax_amount: number;
  platform_total_retained: number;
  station_subtotal: number;
  station_tax_amount: number;
  station_total_transferred: number;
};

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

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

function parseNonNegativeMoney(value: string, label: string): number {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label} configuration`);
  }

  return normalizeMoneyToCents(parsed);
}

function centsToMoney(amountCents: number): number {
  return amountCents / 100;
}

function toDecimal(v: string | number): string {
  return typeof v === 'number' ? v.toFixed(2) : String(v);
}

/**
 * Maps a ReservationSplit to the reservations table's financial-snapshot columns.
 * Shared by every entry-creation path (standard/QR reservations, queue joins, walk-ins)
 * so the 16-column mapping never drifts between call sites.
 */
export function mapSplitToEntryFinancialSnapshot(split: ReservationSplit) {
  return {
    amount_paid: toDecimal(split.client_total),
    commission_rate: split.commissionRate,
    commission_amount: toDecimal(split.commissionAmount),
    station_payout: toDecimal(split.station_total_transferred),
    station_service_total: toDecimal(split.station_service_total),
    platform_service_fee: toDecimal(split.platform_service_fee),
    taxable_subtotal: toDecimal(split.taxable_subtotal),
    tps_amount: toDecimal(split.tps_amount),
    tvq_amount: toDecimal(split.tvq_amount),
    client_total: toDecimal(split.client_total),
    platform_subtotal: toDecimal(split.platform_subtotal),
    platform_tax_amount: toDecimal(split.platform_tax_amount),
    platform_total_retained: toDecimal(split.platform_total_retained),
    station_subtotal: toDecimal(split.station_subtotal),
    station_tax_amount: toDecimal(split.station_tax_amount),
    station_total_transferred: toDecimal(split.station_total_transferred),
  };
}

function buildReservationSplitSnapshot(params: {
  bookingSource: BookingSource;
  serviceTotalCents: number;
  platformServiceFeeCents: number;
  commissionRate: string;
  commissionCents: number;
}): ReservationSplit {
  const {
    bookingSource,
    serviceTotalCents,
    platformServiceFeeCents,
    commissionRate,
    commissionCents,
  } = params;

  const stationSubtotalCents = serviceTotalCents - commissionCents;
  const platformSubtotalCents = commissionCents + platformServiceFeeCents;
  const taxableSubtotalCents = serviceTotalCents + platformServiceFeeCents;
  const tpsCents = Math.round(taxableSubtotalCents * TPS_RATE);
  const tvqCents = Math.round(taxableSubtotalCents * TVQ_RATE);
  const clientTotalCents = taxableSubtotalCents + tpsCents + tvqCents;

  const platformTpsCents = Math.round(platformSubtotalCents * TPS_RATE);
  const platformTvqCents = Math.round(platformSubtotalCents * TVQ_RATE);
  const platformTaxCents = platformTpsCents + platformTvqCents;
  const stationTaxCents = tpsCents + tvqCents - platformTaxCents;
  const stationTotalTransferredCents = stationSubtotalCents + stationTaxCents;
  const platformTotalRetainedCents = platformSubtotalCents + platformTaxCents;

  return {
    bookingSource,
    commissionRate,
    commissionAmount: centsToMoney(commissionCents),
    stationPayout: centsToMoney(stationTotalTransferredCents),
    station_service_total: centsToMoney(serviceTotalCents),
    platform_service_fee: centsToMoney(platformServiceFeeCents),
    taxable_subtotal: centsToMoney(taxableSubtotalCents),
    tps_amount: centsToMoney(tpsCents),
    tvq_amount: centsToMoney(tvqCents),
    client_total: centsToMoney(clientTotalCents),
    platform_subtotal: centsToMoney(platformSubtotalCents),
    platform_tax_amount: centsToMoney(platformTaxCents),
    platform_total_retained: centsToMoney(platformTotalRetainedCents),
    station_subtotal: centsToMoney(stationSubtotalCents),
    station_tax_amount: centsToMoney(stationTaxCents),
    station_total_transferred: centsToMoney(stationTotalTransferredCents),
  };
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
/**
 * Computes the financial snapshot for a walk-in entry (payment collected on-site,
 * off-platform — no Stripe PaymentIntent, no platform commission, no platform service fee).
 *
 * The station still owes TPS/TVQ on the service it sold, so the sales tax is computed on the
 * service price alone and attributed entirely to the station (station_total_transferred),
 * while commission/platform_service_fee/platform_total_retained stay at 0 — the platform never
 * processes or takes a cut of this payment.
 *
 * @param {number} amountTotal - Walk-in service total in major currency units
 * @returns {ReservationSplit} Split with zeroed platform commission/fee and full tax attributed to the station
 */
export function computeWalkInSplit(amountTotal: number): ReservationSplit {
  const serviceTotalCents = normalizeMoneyToCents(amountTotal);
  return buildReservationSplitSnapshot({
    bookingSource: 'standard',
    serviceTotalCents,
    platformServiceFeeCents: 0,
    commissionRate: '0.0000',
    commissionCents: 0,
  });
}

export async function computeReservationSplit(params: {
  amountTotal: number;
  isQrBooking: boolean;
  promotionReductionRate?: string | null;
}): Promise<ReservationSplit> {
  const { amountTotal, isQrBooking, promotionReductionRate = null } = params;
  const serviceTotalCents = normalizeMoneyToCents(amountTotal);

  if (isQrBooking) {
    // QR bookings never need the commission rate (they zero it out), so skip that lookup.
    const platformServiceFeeRaw = await getPlatformServiceFee();
    const platformServiceFeeCents = parseNonNegativeMoney(
      platformServiceFeeRaw,
      'platform service fee',
    );
    return buildReservationSplitSnapshot({
      bookingSource: 'qr',
      serviceTotalCents,
      platformServiceFeeCents,
      commissionRate: '0.0000',
      commissionCents: 0,
    });
  }

  // Independent settings lookups — run in parallel instead of two sequential round trips
  // on every booking/queue-join.
  const [platformServiceFeeRaw, commissionRate] = await Promise.all([
    getPlatformServiceFee(),
    getActiveCommissionRate(),
  ]);
  const platformServiceFeeCents = parseNonNegativeMoney(
    platformServiceFeeRaw,
    'platform service fee',
  );
  const commissionRateNumber = parseRate(commissionRate, 'commission rate');

  if (promotionReductionRate != null) {
    const reductionRateNumber = parseRate(promotionReductionRate, 'promotion reduction rate');
    const effectiveCommissionRate = commissionRateNumber * (1 - reductionRateNumber);
    const effectiveCommissionRateString = effectiveCommissionRate.toFixed(4);
    const commissionCents = Math.round(serviceTotalCents * effectiveCommissionRate);

    return buildReservationSplitSnapshot({
      bookingSource: 'standard',
      serviceTotalCents,
      platformServiceFeeCents,
      commissionRate: effectiveCommissionRateString,
      commissionCents,
    });
  }

  const commissionCents = Math.round(serviceTotalCents * commissionRateNumber);

  return buildReservationSplitSnapshot({
    bookingSource: 'standard',
    serviceTotalCents,
    platformServiceFeeCents,
    commissionRate,
    commissionCents,
  });
}
