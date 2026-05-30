/**
 * Stalled payment recovery service.
 *
 * Problem: a client completes Stripe 3DS / payment authorization, but the
 * `payment_intent.amount_capturable_updated` webhook never arrives (Stripe
 * outage, misconfigured endpoint, missing STRIPE_WEBHOOK_SECRET in env).
 * The reservation stays `pending_payment` forever — the client has a card
 * hold but no confirmed reservation.
 *
 * Solution: a cron polls Stripe directly for entries stuck in
 * `pending_payment` with a `stripe_payment_id` older than N minutes.
 * If Stripe says the PI is `requires_capture`, we apply the same
 * confirmation logic as the webhook handler.
 * If Stripe says the PI is `canceled` or `payment_failed`, we cancel the entry.
 *
 * Idempotent: `confirmEntryIfPendingPayment` uses WHERE status='pending_payment',
 * so a concurrent webhook that arrives during a recovery run produces no double-confirm.
 */
import { stripe } from '@/lib/stripe';
import { runWithConcurrencyLimit } from '@/helpers/concurrency';
import {
  confirmEntryIfPendingPayment,
  cancelEntryForStripePaymentFailureIfEligible,
  findStalledPendingPaymentEntries,
} from './entry-repository';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';
import { db } from '@/lib/db';
import { notifyEntry } from '@/server/notifications/notification-service';
import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';
import { logFinancialEvent } from '@/server/payments/financial-event-logger';
import { cancelPaymentIntent } from '@/server/payments/payment-service';

export type StalledPaymentRecoveryResult = {
  checked: number;
  confirmed: number;
  cancelled: number;
  /** Entries whose PI sat in a non-terminal state past the absolute timeout and were force-cancelled. */
  forceCancelled: number;
  skipped: number;
  errors: Array<{ entryId: string; error: string }>;
};

const RECOVERY_CONCURRENCY = 5;

/**
 * Absolute age (in hours) after which a `pending_payment` entry is force-cancelled regardless of
 * Stripe PI status. Covers cases where the PI stays in `requires_action` (3DS abandoned),
 * `processing` (SEPA/voucher that never resolves) or `requires_confirmation` forever, which
 * would otherwise keep the slot blocked indefinitely (bug #9).
 *
 * Default: 48h. Override via STALLED_PAYMENT_FORCE_CANCEL_AGE_HOURS.
 */
const FORCE_CANCEL_AGE_HOURS = (() => {
  const raw = parseInt(process.env.STALLED_PAYMENT_FORCE_CANCEL_AGE_HOURS ?? '48', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 48;
})();

/**
 * Polls Stripe for all pending_payment entries with a PI older than staleMinutes
 * and reconciles each one based on the actual Stripe PI status.
 */
export async function recoverStalledPayments(
  staleMinutes: number
): Promise<StalledPaymentRecoveryResult> {
  const entries = await findStalledPendingPaymentEntries(staleMinutes);
  const result: StalledPaymentRecoveryResult = {
    checked: entries.length,
    confirmed: 0,
    cancelled: 0,
    forceCancelled: 0,
    skipped: 0,
    errors: [],
  };
  const forceCancelCutoffMs = FORCE_CANCEL_AGE_HOURS * 60 * 60 * 1000;

  await runWithConcurrencyLimit(entries, RECOVERY_CONCURRENCY, async (entry) => {
    if (!entry.stripe_payment_id) return;

    let pi: Awaited<ReturnType<typeof stripe.paymentIntents.retrieve>>;
    try {
      pi = await stripe.paymentIntents.retrieve(entry.stripe_payment_id);
    } catch (e) {
      result.errors.push({
        entryId: entry.id,
        error: e instanceof Error ? e.message : String(e),
      });
      return;
    }

    if (pi.status === 'requires_capture') {
      // Card authorized — confirm the reservation (same logic as webhook handler).
      const confirmed = await confirmEntryIfPendingPayment(entry.id);
      if (confirmed) {
        result.confirmed += 1;
        logFinancialEvent({
          event: 'STALLED_PAYMENT_RECOVERED',
          entryId: entry.id,
          stripePaymentIntentId: entry.stripe_payment_id,
          userId: entry.user_id,
          stationId: entry.station_id,
          meta: { pi_status: pi.status, recovery_method: 'cron_poll' },
        });
        // Best-effort notification — same as the webhook path.
        notifyEntry({
          entryId: entry.id,
          userId: entry.user_id,
          stationId: entry.station_id,
          type: 'reservation_confirmed',
        }).catch(() => {});
        notifyClientFeed({
          userId: entry.user_id,
          entryId: entry.id,
          stationId: entry.station_id,
          kind: 'reservation_confirmed',
          body: 'Votre réservation est confirmée. À bientôt !',
        }).catch(() => {});
      } else {
        result.skipped += 1; // Already confirmed by concurrent webhook.
      }
      return;
    }

    if (pi.status === 'canceled' || pi.status === 'requires_payment_method') {
      // Card never authorized or PI explicitly cancelled — cancel the entry.
      // Track effective cancellation via a flag set only after the transaction commits, so a
      // rollback inside the transaction (e.g. decrementSlotBookedCount failure) does not lead
      // the counter to over-count cancellations (bug #6). Same pattern as orphan-cleanup-service.
      let wasActuallyCancelled = false;
      try {
        await db.transaction(async (tx) => {
          const row = await cancelEntryForStripePaymentFailureIfEligible(
            entry.id,
            `Stripe PI ${pi.status} (recovered by stalled-payment cron)`,
            tx
          );
          if (!row) return;
          if (row.time_slot_id) {
            await decrementSlotBookedCount(row.time_slot_id, tx);
          }
          wasActuallyCancelled = true;
        });
      } catch (e) {
        // Transaction rolled back. Surface the error and treat as a skip for accounting.
        result.errors.push({
          entryId: entry.id,
          error: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      if (wasActuallyCancelled) {
        result.cancelled += 1;
        console.warn('[STALLED_PAYMENT_RECOVERY] Cancelled stalled entry', {
          entryId: entry.id,
          pi_status: pi.status,
          stripe_payment_id: entry.stripe_payment_id,
        });
      } else {
        result.skipped += 1;
      }
      return;
    }

    // PI is `processing`, `succeeded`, `requires_action`, `requires_confirmation`, etc.
    // For most of these the system can simply wait — but if the entry has been pending for
    // longer than FORCE_CANCEL_AGE_HOURS, the slot is being blocked indefinitely (bug #9):
    // force-cancel the entry and best-effort cancel the PI on the Stripe side.
    const ageMs = Date.now() - entry.created_at.getTime();
    if (ageMs > forceCancelCutoffMs) {
      let wasActuallyCancelled = false;
      try {
        await db.transaction(async (tx) => {
          const row = await cancelEntryForStripePaymentFailureIfEligible(
            entry.id,
            `pi_${pi.status}_timeout_${FORCE_CANCEL_AGE_HOURS}h`,
            tx
          );
          if (!row) return;
          if (row.time_slot_id) {
            await decrementSlotBookedCount(row.time_slot_id, tx);
          }
          wasActuallyCancelled = true;
        });
      } catch (e) {
        result.errors.push({
          entryId: entry.id,
          error: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      if (!wasActuallyCancelled) {
        result.skipped += 1;
        return;
      }
      // Cancel the PI on Stripe's side too — best-effort, the auth either expires naturally
      // or this releases the hold sooner. Some statuses (succeeded, canceled) reject cancel,
      // which is fine.
      if (entry.stripe_payment_id) {
        cancelPaymentIntent(entry.stripe_payment_id).catch(() => undefined);
      }
      result.forceCancelled += 1;
      console.warn('[STALLED_PAYMENT_RECOVERY] Force-cancelled entry past timeout', {
        entryId: entry.id,
        pi_status: pi.status,
        age_hours: Math.round(ageMs / 3_600_000),
      });
      return;
    }

    // Below the absolute timeout: keep waiting. `processing` (SEPA) will resolve on its own,
    // `succeeded` is handled by the payment_intent.succeeded webhook.
    result.skipped += 1;
  });

  return result;
}
