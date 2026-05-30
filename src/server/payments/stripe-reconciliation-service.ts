/**
 * Stripe reconciliation cron — catches up on Stripe failures the synchronous path could not.
 *
 * Two flows:
 *
 * 1. PI cancel reconciliation (bug #12)
 *    Reservations with `pi_cancel_failed_at IS NOT NULL` had a `cancelPaymentIntent` call
 *    throw. We retry the cancel; if Stripe reports the PI is already cancelled / succeeded,
 *    the marker is cleared. Persistent failures remain marked and are surfaced for ops.
 *
 * 2. Refund id reconciliation (bug #26)
 *    Reservations with `refund_persist_failed_at IS NOT NULL` had `Stripe.refunds.create`
 *    succeed but the `stripe_refund_id` write fail. We list refunds on the PI to recover
 *    the id and persist it.
 *
 * Stripe-side cost: each entry costs at most 2 Stripe API calls per cron run (cancel +
 * retrieve for #12; refunds.list for #26). Scan limited to 50 entries per run by default.
 */
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import {
  cancelPaymentIntent,
  classifyStripeError,
} from './payment-service';
import { logFinancialEvent } from './financial-event-logger';
import {
  clearPiCancelFailed,
  clearRefundPersistFailed,
  findReservationsNeedingPiCancel,
  findReservationsNeedingRefundPersist,
  updateEntry,
} from '@/server/reservations/entry-repository';

export type ReconciliationResult = {
  pi_cancel: { scanned: number; cleared: number; still_failing: number; errors: number };
  refund_persist: { scanned: number; recovered: number; not_found: number; errors: number };
};

const DEFAULT_BATCH = 50;

/** Best-effort recovery for both failure markers. Safe to run as often as the cron schedules. */
export async function runStripeReconciliation(batch = DEFAULT_BATCH): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    pi_cancel: { scanned: 0, cleared: 0, still_failing: 0, errors: 0 },
    refund_persist: { scanned: 0, recovered: 0, not_found: 0, errors: 0 },
  };

  // ── 1. PI cancel reconciliation ────────────────────────────────────────────
  const piRows = await findReservationsNeedingPiCancel(batch);
  result.pi_cancel.scanned = piRows.length;

  for (const row of piRows) {
    if (!row.stripe_payment_id) continue;
    try {
      await cancelPaymentIntent(row.stripe_payment_id);
      await clearPiCancelFailed(row.id);
      result.pi_cancel.cleared += 1;
    } catch (e) {
      // Already cancelled / succeeded — both terminal states. The hold is released.
      if (e instanceof Stripe.errors.StripeInvalidRequestError) {
        const msg = e.message || '';
        if (e.code === 'payment_intent_unexpected_state' || /already.*(canceled|succeeded)/i.test(msg)) {
          await clearPiCancelFailed(row.id);
          result.pi_cancel.cleared += 1;
          continue;
        }
      }
      const err = classifyStripeError(e);
      result.pi_cancel.still_failing += 1;
      if (err.class !== 'card_declined') result.pi_cancel.errors += 1;
      logFinancialEvent({
        event: 'PI_CANCEL_FAILED',
        stripePaymentIntentId: row.stripe_payment_id,
        entryId: row.id,
        userId: row.user_id,
        stationId: row.station_id,
        meta: {
          error_class: err.class,
          error_code: err.code ?? null,
          context: 'reconciliation_retry',
        },
      });
    }
  }

  // ── 2. Refund persist reconciliation ───────────────────────────────────────
  const refundRows = await findReservationsNeedingRefundPersist(batch);
  result.refund_persist.scanned = refundRows.length;

  for (const row of refundRows) {
    if (!row.stripe_payment_id) continue;
    try {
      // Get the most recent refund attached to this PI. The financial event log captured
      // the id at creation time, but we re-derive from Stripe to be authoritative.
      const refunds = await stripe.refunds.list({ payment_intent: row.stripe_payment_id, limit: 1 });
      const refundId = refunds.data[0]?.id ?? null;
      if (!refundId) {
        result.refund_persist.not_found += 1;
        // No refund found on Stripe — the original `refundPaymentIntent` may have failed
        // for a reason other than persistence. Clear the marker so we don't retry forever;
        // the operator should consult the financial event log to decide whether to manually
        // refund.
        await clearRefundPersistFailed(row.id).catch(() => undefined);
        continue;
      }
      await updateEntry(row.id, { stripe_refund_id: refundId });
      await clearRefundPersistFailed(row.id);
      result.refund_persist.recovered += 1;
    } catch (e) {
      result.refund_persist.errors += 1;
      const err = classifyStripeError(e);
      logFinancialEvent({
        event: 'REFUND_PERSIST_FAILED',
        stripePaymentIntentId: row.stripe_payment_id,
        entryId: row.id,
        userId: row.user_id,
        stationId: row.station_id,
        meta: {
          error_class: err.class,
          error_code: err.code ?? null,
          context: 'reconciliation_retry',
        },
      });
    }
  }

  return result;
}
