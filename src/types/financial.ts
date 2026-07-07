/**
 * Shared financial snapshot for paid client entries (reservation + queue).
 *
 * The backend persists a detailed financial breakdown on every paid entry and
 * serializes it identically across booking creation, client history, station
 * history and admin transactions. All monetary fields are Postgres `decimal`
 * columns, so they arrive over the wire as strings (e.g. "20.00"), never numbers.
 *
 * Golden rule (see folder/MUST_READ/frontend_scope_extension_paiement_taxes_LAVO.md):
 * the frontend DISPLAYS these values, it never recomputes TPS, TVQ, the platform
 * share or the station share locally. Use the parsed numbers only for formatting.
 */

/** Currency of the in-app receipt. Fixed by the backend for this module. */
export const RECEIPT_CURRENCY = 'CAD' as const;
export type ReceiptCurrency = typeof RECEIPT_CURRENCY;

/**
 * Raw financial snapshot exactly as sent by the API (decimal strings).
 *
 * Fields are nullable because history and admin-transaction payloads expose the
 * detailed breakdown only for `reservation`-style paid entries; `tip` and
 * `penalty` transaction rows carry `null` for every detailed field. `amount_paid`
 * is the one field the backend always fills for a paid entry.
 */
export interface RawFinancialSnapshot {
  /** Legacy total paid by the client. Kept for compatibility; prefer client_total. */
  amount_paid: string;
  /** Sum of the station service prices before platform fee and taxes. */
  station_service_total: string | null;
  /** Fixed platform service fee applied to the entry. */
  platform_service_fee: string | null;
  /** Service total + platform fee, i.e. the base the taxes are computed on. */
  taxable_subtotal: string | null;
  /** GST / TPS amount. */
  tps_amount: string | null;
  /** QST / TVQ amount. */
  tvq_amount: string | null;
  /** Final total charged to the client (== amount_paid in this module). */
  client_total: string | null;
  /** Effective commission rate as a 0..1 decimal string (e.g. "0.1000"). */
  commission_rate?: string | null;
  /** Platform commission taken on the service total. */
  commission_amount: string | null;
  /** Commission + platform service fee, before platform taxes. */
  platform_subtotal: string | null;
  /** Taxes attributable to the platform share. */
  platform_tax_amount: string | null;
  /** True amount kept by the platform. Prefer this over commission_amount. */
  platform_total_retained: string | null;
  /** Legacy station payout. Kept for compatibility; prefer station_total_transferred. */
  station_payout?: string | null;
  /** Station service total minus commission, before station taxes. */
  station_subtotal: string | null;
  /** Taxes attributable to the station share. */
  station_tax_amount: string | null;
  /** True amount transferred to the station. Prefer this over station_payout. */
  station_total_transferred: string | null;
}

/**
 * Parsed financial snapshot for UI formatting. Every monetary field is a number
 * (or null when the API omitted it, e.g. tip/penalty transaction rows).
 */
export interface FinancialSnapshot {
  amountPaid: number;
  stationServiceTotal: number | null;
  platformServiceFee: number | null;
  taxableSubtotal: number | null;
  tpsAmount: number | null;
  tvqAmount: number | null;
  clientTotal: number | null;
  commissionRate: number | null;
  commissionAmount: number | null;
  platformSubtotal: number | null;
  platformTaxAmount: number | null;
  platformTotalRetained: number | null;
  stationPayout: number | null;
  stationSubtotal: number | null;
  stationTaxAmount: number | null;
  stationTotalTransferred: number | null;
}

/**
 * Parses a decimal string amount into a number.
 *
 * @param value - Decimal string such as "20.00", or null/undefined when absent.
 * @returns The parsed number, or null when the input is missing or unparseable.
 */
export function parseMoney(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Maps a raw API financial snapshot to parsed numbers for display.
 *
 * @param raw - The raw snapshot (decimal strings) from any API surface.
 * @returns A parsed snapshot with numeric fields, preserving nulls.
 */
export function parseFinancialSnapshot(raw: RawFinancialSnapshot): FinancialSnapshot {
  return {
    amountPaid: parseMoney(raw.amount_paid) ?? 0,
    stationServiceTotal: parseMoney(raw.station_service_total),
    platformServiceFee: parseMoney(raw.platform_service_fee),
    taxableSubtotal: parseMoney(raw.taxable_subtotal),
    tpsAmount: parseMoney(raw.tps_amount),
    tvqAmount: parseMoney(raw.tvq_amount),
    clientTotal: parseMoney(raw.client_total),
    commissionRate: parseMoney(raw.commission_rate),
    commissionAmount: parseMoney(raw.commission_amount),
    platformSubtotal: parseMoney(raw.platform_subtotal),
    platformTaxAmount: parseMoney(raw.platform_tax_amount),
    platformTotalRetained: parseMoney(raw.platform_total_retained),
    stationPayout: parseMoney(raw.station_payout),
    stationSubtotal: parseMoney(raw.station_subtotal),
    stationTaxAmount: parseMoney(raw.station_tax_amount),
    stationTotalTransferred: parseMoney(raw.station_total_transferred),
  };
}

/**
 * Formats a numeric amount as a display string with the `$` prefix used across
 * the booking, history and admin surfaces (e.g. 20 -> "$20.00").
 *
 * @param value - The amount to format, or null/undefined.
 * @param fallback - String returned when the value is missing (default "-").
 * @returns The formatted amount, or the fallback when absent.
 */
export function formatAmount(value: number | null | undefined, fallback = '-'): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return `$${value.toFixed(2)}`;
}

/**
 * True when the snapshot carries a detailed tax/fee breakdown (not just a total).
 *
 * `tip` and `penalty` transaction rows return null for every detailed field, so
 * the caller can fall back to a compact single-total display for those.
 *
 * @param raw - The raw snapshot to inspect.
 * @returns Whether the detailed breakdown is present.
 */
export function hasDetailedBreakdown(raw: RawFinancialSnapshot): boolean {
  return raw.client_total != null || raw.taxable_subtotal != null;
}
