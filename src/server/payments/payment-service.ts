/**
 * Payment services (Stripe PaymentIntent, redistribution). Stub implementation;
 * wire real Stripe when integrating. Used by reservation and queue flows.
 */

export type ProcessPaymentParams = {
  amountCents: number;
  currency?: string;
  userId: string;
  stationId: string;
  entryId?: string;
  metadata?: Record<string, string>;
};

export type ProcessPaymentResult = {
  success: boolean;
  stripePaymentId?: string | null;
  error?: string;
};

/**
 * Processes a payment for a reservation or queue entry. Stub: returns success and a placeholder id.
 * Replace with Stripe PaymentIntent create + confirm when integrating.
 */
export async function processPayment(
  _params: ProcessPaymentParams
): Promise<ProcessPaymentResult> {
  return {
    success: true,
    stripePaymentId: `pi_stub_${Date.now()}`,
  };
}

/**
 * Placeholder for payment services (legacy). Prefer processPayment.
 */
export function paymentServicePlaceholder() {
  // no-op; use processPayment for new flows
}

