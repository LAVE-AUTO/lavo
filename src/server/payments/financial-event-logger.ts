/**
 * Financial event logger — structured, immutable trace of every money movement.
 *
 * Events are written to stdout as JSON with the prefix [FINANCIAL_EVENT].
 * This format is ingestible by Railway/Vercel log drains and searchable with
 * `grep "[FINANCIAL_EVENT]"`. Each event includes enough context for an ops
 * team to manually replay or reverse any transaction without Stripe Dashboard access.
 *
 * Future: replace logFinancialEvent() body with a DB insert into a dedicated
 * `financial_events` table for in-app auditability.
 */

export type FinancialEventType =
  | 'PI_CREATED'            // PaymentIntent authorized on client card
  | 'PI_CAPTURED'           // Funds captured (service completed / no-show / late cancel)
  | 'PI_CANCELLED'          // Authorization released (free cancel / abandoned)
  | 'PI_CANCEL_FAILED'      // cancelPaymentIntent threw — card hold may persist until Stripe auto-expires (bug #12)
  | 'REFUND_ISSUED'         // Partial or full refund issued to client
  | 'REFUND_PERSIST_FAILED' // Stripe refund succeeded but stripe_refund_id failed to persist on entry (bug #26)
  | 'PENALTY_DISTRIBUTED'   // Transfer reversal: platform claws back its penalty share
  | 'TIP_CREATED'           // Tip PI created (capture_method: automatic)
  | 'TIP_CAPTURED'          // Tip PI confirmed by webhook
  | 'DISPUTE_REFUND'        // Admin-initiated refund for a dispute
  | 'CAPTURE_SKIPPED'       // PI was already canceled at capture time — no funds moved
  | 'STALLED_PAYMENT_RECOVERED'; // Webhook-missed entry confirmed via Stripe poll

export type FinancialEventPayload = {
  event: FinancialEventType;
  reservationId?: string;
  entryId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeRefundId?: string;
  stripeTransferId?: string;
  stripeReversalId?: string;
  amountCents?: number;
  currency?: string;
  userId?: string;
  stationId?: string;
  /** Any extra context — kept small (no PII beyond IDs). */
  meta?: Record<string, string | number | boolean | null>;
};

/**
 * Emits a structured financial event to the application log stream.
 * Call this after every successful (or definitively failed) Stripe operation
 * so the ops team can reconstruct any transaction without Stripe Dashboard access.
 *
 * Fire-and-forget: never await this in a hot path since log writes should never
 * block financial operations.
 */
export function logFinancialEvent(payload: FinancialEventPayload): void {
  // Intentionally synchronous console.log: in Node.js this is buffered and
  // non-blocking. Using a Promise here would make callers silently swallow
  // logging errors if they forget to await.
  console.log(
    JSON.stringify({
      level: 'FINANCIAL_EVENT',
      ...payload,
      ts: new Date().toISOString(),
    })
  );
}
