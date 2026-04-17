/**
 * Stripe utility helpers.
 *
 * Pure, side-effect-free functions for validating and working with Stripe
 * data. Centralised here so every call-site uses the same validation logic.
 */

/**
 * Returns true only when `value` is an HTTPS URL on the stripe.com domain
 * pointing to a receipt page.
 *
 * Rejects:
 *   - non-HTTPS protocols
 *   - embedded credentials (user:pass@)
 *   - non-standard ports
 *   - hosts that are not stripe.com or a *.stripe.com subdomain
 *   - paths that do not start with /receipts
 *
 * @param value - The URL string to validate.
 * @returns `true` if the URL is a trusted Stripe receipt URL, `false` otherwise.
 *
 * @example
 * isTrustedStripeReceiptUrl('https://pay.stripe.com/receipts/abc123'); // true
 * isTrustedStripeReceiptUrl('https://evil.com/receipts/abc123');       // false
 */
export function isTrustedStripeReceiptUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== '443') return false;
    const host = parsed.hostname.toLowerCase();
    if (!(host === 'stripe.com' || host.endsWith('.stripe.com'))) return false;

    // Only allow Stripe receipt pages to avoid unrelated external redirects.
    return /^\/receipts(\/|$)/.test(parsed.pathname);
  } catch {
    return false;
  }
}
