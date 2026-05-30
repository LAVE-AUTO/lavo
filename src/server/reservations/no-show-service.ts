/**
 * No-show detection for walk-in queue entries.
 *
 * Runs after each station's closing time. For every active queue entry (pending / confirmed / late)
 * whose station has closed for the day, the service:
 *   1. Cancels the entry in the DB.
 *   2. Captures the authorized PaymentIntent (materialises the charge).
 *   3. Issues a partial refund for (amount_paid - cancellation_fee).
 *   4. Distributes the penalty share between the platform and the station.
 *   5. Notifies the client.
 *
 * The "effective date" of a queue entry is determined by created_at:
 *   - For walk-in entries: created_at is the day the client joined the queue.
 *   - For late reservations moved to queue: created_at reflects the original booking date.
 * Using created_at avoids false date shifts caused by position updates or refund ID writes,
 * which modify updated_at without changing the service date.
 */
import { parseTimeForDate } from '@/helpers/date-helper';
import { runWithConcurrencyLimit } from '@/helpers/concurrency';
import { getCancellationPolicy } from '@/server/admin/platform-settings-service';
import { getConfigByStationId } from '@/server/station/config-repository';
import {
  capturePaymentIntent,
  refundPaymentIntent,
  distributePenalty,
  classifyStripeError,
} from '@/server/payments/payment-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';
import {
  listActiveQueueEntries,
  updateEntry,
  cancelQueueEntryForNoShowIfEligible,
  setStripeTransferIdIfMissing,
  type Entry,
} from './entry-repository';

export type MarkNoShowsResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ entryId: string; error: string }>;
};

// runWithConcurrencyLimit enforces an internal ceiling of 10; keep this value <= 10.
const NO_SHOW_CONCURRENCY = 8;

/** Max entries scanned per cron invocation — protects memory and Stripe API quotas. */
const NO_SHOW_BATCH_LIMIT = 500;

/**
 * Detects active queue entries whose station has closed for the entry's effective date,
 * applies cancellation fees, and cancels them.
 *
 * Bounded scan: processes at most NO_SHOW_BATCH_LIMIT entries per invocation. Run the cron
 * more frequently if your platform regularly accumulates more no-shows per closing wave —
 * the operation is idempotent (cancelQueueEntryForNoShowIfEligible is conditional).
 */
export async function markQueueNoShows(): Promise<MarkNoShowsResult> {
  const [entries, policy] = await Promise.all([
    listActiveQueueEntries(NO_SHOW_BATCH_LIMIT),
    getCancellationPolicy(),
  ]);

  // Batch-load station configs to avoid N+1 queries inside the concurrency loop.
  const stationIds = [...new Set(entries.map((e) => e.station_id))];
  const configEntries = await Promise.all(
    stationIds.map((sid) => getConfigByStationId(sid).then((c) => [sid, c] as const))
  );
  const configMap = new Map(configEntries);

  const now = new Date();
  const result: MarkNoShowsResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };

  // Only process entries whose station has already closed for their effective day.
  const toProcess: Entry[] = entries.filter((entry) => {
    const config = configMap.get(entry.station_id);
    if (!config?.closing_time) return false;
    const effectiveDateStr = entry.created_at.toISOString().slice(0, 10);
    const closingTime = parseTimeForDate(effectiveDateStr, config.closing_time as string);
    return now > closingTime;
  });

  result.processed = toProcess.length;

  const settled = await runWithConcurrencyLimit(toProcess, NO_SHOW_CONCURRENCY, async (entry) => {
    // Defensive: DB could theoretically contain a non-numeric or negative amount_paid
    // (data-migration bug, manual edit). Clamp to a non-negative finite number so we can
    // never compute negative Stripe cents, which would be rejected or misapplied.
    const rawAmount = parseFloat(String(entry.amount_paid));
    const amountPaid = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;
    const penaltyAmount = Math.max(
      0,
      Math.round(amountPaid * policy.penaltyRate * 100) / 100
    );
    const refundedAmount = Math.max(
      0,
      Math.round((amountPaid - penaltyAmount) * 100) / 100
    );

    // Guarded cancel: only proceed if the row is still in an active status. If a previous
    // cron run (or a concurrent overlap) has already cancelled this entry, the conditional
    // update returns undefined and we skip the Stripe side entirely. Prevents double-capture,
    // double-refund, and double-penalty-reversal - all of which are real financial risks.
    const cancelled = await cancelQueueEntryForNoShowIfEligible(
      entry.id,
      penaltyAmount > 0 ? penaltyAmount.toFixed(2) : null
    );
    if (!cancelled) {
      return; // Another run already processed this entry.
    }

    // Stripe: capture → partial refund → distribute penalty.
    // Idempotency keys scoped to the entry ID so cron retries after a network timeout do not
    // create a second refund or a second transfer reversal. Stripe's capture is naturally
    // idempotent on a PaymentIntent (subsequent captures return the same charge), so no key is
    // required there.
    if (entry.stripe_payment_id) {
      let captureResult: Awaited<ReturnType<typeof capturePaymentIntent>> | null = null;
      try {
        captureResult = await capturePaymentIntent(entry.stripe_payment_id);
      } catch (e) {
        const err = classifyStripeError(e);
        console.error('[NO_SHOW_CAPTURE_FAILED]', {
          entryId: entry.id,
          stripe_payment_id: entry.stripe_payment_id,
          error_class: err.class,
          error_code: err.code,
          error: err.message,
        });
      }

      const charged = captureResult?.charged ?? false;
      const chargeId = captureResult?.chargeId ?? null;
      const transferId = captureResult?.transferId ?? null;

      if (charged && chargeId) {
        try {
          await updateEntry(entry.id, { stripe_charge_id: chargeId });
        } catch (e) {
          console.error('[NO_SHOW_STRIPE_CHARGE_ID_UPDATE_FAILED]', {
            entryId: entry.id,
            chargeId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      if (charged && transferId) {
        // Persist stripe_transfer_id so a later admin refund correctly reverses the
        // station's transfer instead of taking the loss from the platform balance.
        await setStripeTransferIdIfMissing(entry.id, transferId).catch((e) => {
          console.error('[NO_SHOW_TRANSFER_ID_PERSIST_FAILED]', {
            entryId: entry.id,
            transferId,
            error: e instanceof Error ? e.message : String(e),
          });
        });
      }
      if (charged && refundedAmount > 0) {
        try {
          const refundId = await refundPaymentIntent(
            entry.stripe_payment_id,
            Math.round(refundedAmount * 100),
            `no-show-refund:${entry.id}`
          );
          await updateEntry(entry.id, { stripe_refund_id: refundId });
        } catch (e) {
          console.error('[NO_SHOW_REFUND_FAILED]', {
            entryId: entry.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      if (charged && penaltyAmount > 0) {
        try {
          await distributePenalty(
            entry.stripe_payment_id,
            Math.round(penaltyAmount * 100),
            policy.stationPenaltyShare,
            `no-show-penalty:${entry.id}`,
            chargeId ?? undefined,
            transferId ?? undefined,
          );
        } catch (e) {
          console.error('[NO_SHOW_PENALTY_DIST_FAILED]', {
            entryId: entry.id,
            stripe_payment_id: entry.stripe_payment_id,
            penalty_amount_cents: Math.round(penaltyAmount * 100),
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    // Notification failures must not re-classify this entry as "failed": the DB is already
    // cancelled and the Stripe side has already run. Log the failure and keep the outer
    // promise resolved so the result counters reflect financial state, not delivery state.
    try {
      await notifyEntry({
        entryId: entry.id,
        userId: entry.user_id,
        stationId: entry.station_id,
        type: 'queue_no_show',
        payload: { penaltyAmount, refundedAmount },
      });
      await notifyClientFeed({
        userId: entry.user_id,
        entryId: entry.id,
        stationId: entry.station_id,
        kind: 'queue_no_show',
        body: 'Votre réservation a été annulée car la station a fermé pour la journée.',
      });
    } catch (e) {
      console.error('[NO_SHOW_NOTIFY_FAILED]', {
        entryId: entry.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  settled.forEach((outcome, index) => {
    const entry = toProcess[index];
    if (!entry) return;
    if (outcome.status === 'fulfilled') {
      result.succeeded += 1;
    } else {
      result.failed += 1;
      result.errors.push({
        entryId: entry.id,
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      });
    }
  });

  return result;
}
