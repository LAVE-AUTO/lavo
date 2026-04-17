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
} from '@/server/payments/payment-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import {
  listActiveQueueEntries,
  updateEntry,
  cancelQueueEntryForNoShowIfEligible,
  type Entry,
} from './entry-repository';

export type MarkNoShowsResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ entryId: string; error: string }>;
};

const NO_SHOW_CONCURRENCY = 8;

/**
 * Detects all active queue entries whose station has closed for the entry's effective date,
 * applies cancellation fees, and cancels them.
 */
export async function markQueueNoShows(): Promise<MarkNoShowsResult> {
  const [entries, policy] = await Promise.all([
    listActiveQueueEntries(),
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
    // double-refund, and double-penalty-reversal — all of which are real financial risks.
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
      let captured = false;
      try {
        await capturePaymentIntent(entry.stripe_payment_id);
        captured = true;
      } catch (e) {
        console.error('[NO_SHOW_CAPTURE_FAILED]', {
          entryId: entry.id,
          stripe_payment_id: entry.stripe_payment_id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      if (captured && refundedAmount > 0) {
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
      if (captured && penaltyAmount > 0) {
        try {
          await distributePenalty(
            entry.stripe_payment_id,
            Math.round(penaltyAmount * 100),
            policy.stationPenaltyShare
          );
        } catch (e) {
          console.error('[NO_SHOW_PENALTY_DIST_FAILED]', {
            entryId: entry.id,
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
