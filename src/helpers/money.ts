/**
 * Shared money formatting helpers used by every UI surface that displays a price.
 *
 * Business rule: all prices are rendered with a dot decimal separator and exactly
 * two fractional digits, even for whole-dollar amounts (e.g. 15.00, 15.23).
 * This keeps the display consistent across French and English UIs and avoids
 * losing cents because of a locale-specific comma separator or a `toFixed(0)` call.
 */

/**
 * Parses a price that may arrive as a number, decimal string, null or undefined.
 * Invalid values fall back to `null`.
 */
export function parsePrice(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface FormatMoneyOptions {
  /** Currency symbol to render. */
  symbol?: string;
  /** Whether the symbol appears before or after the amount. */
  position?: 'prefix' | 'suffix';
  /** Text returned when the value is missing or invalid. */
  fallback?: string;
}

/**
 * Formats a price with a dot decimal separator and exactly two fractional digits.
 *
 * @example
 * formatMoney(15)       // "15.00 $"
 * formatMoney(15.23)    // "15.23 $"
 * formatMoney(null)     // "-"
 * formatMoney(15, { position: 'prefix' }) // "$15.00"
 */
export function formatMoney(
  value: number | string | null | undefined,
  options: FormatMoneyOptions = {},
): string {
  const { symbol = '$', position = 'suffix', fallback = '-' } = options;
  const parsed = parsePrice(value);
  if (parsed == null) return fallback;
  const amount = parsed.toFixed(2);
  return position === 'prefix' ? `${symbol}${amount}` : `${amount} ${symbol}`;
}

/**
 * Convenience wrapper for the client UI convention: symbol before the amount.
 *
 * @example
 * formatMoneyPrefix(15.23) // "$15.23"
 */
export function formatMoneyPrefix(value: number | string | null | undefined): string {
  return formatMoney(value, { position: 'prefix' });
}

/**
 * Convenience wrapper for the station UI convention: symbol after the amount.
 *
 * @example
 * formatMoneySuffix(15.23) // "15.23 $"
 */
export function formatMoneySuffix(value: number | string | null | undefined): string {
  return formatMoney(value, { position: 'suffix' });
}
