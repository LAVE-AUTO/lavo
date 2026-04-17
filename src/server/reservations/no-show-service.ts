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
 * The "effective date" of a queue entry is determined by updated_at:
 *   - For late reservations moved to queue: updated_at = the moment of the downgrade (day of service).
 *   - For walk-in entries: updated_at defaults to created_at (join day).
 * Closing time is resolved against that date to avoid false positives during early-morning cron runs.
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
import { listActiveQueueEntries, updateEntry, type Entry } from './entry-repository';

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
    const effectiveDateStr = entry.updated_at.toISOString().slice(0, 10);
    const closingTime = parseTimeForDate(effectiveDateStr, config.closing_time as string);
    return now > closingTime;
  });

  result.processed = toProcess.length;

  const settled = await runWithConcurrencyLimit(toProcess, NO_SHOW_CONCURRENCY, async (entry) => {
    const amountPaid = parseFloat(String(entry.amount_paid));
    const penaltyAmount = Math.round(amountPaid * policy.penaltyRate * 100) / 100;
    const refundedAmount = Math.round((amountPaid - penaltyAmount) * 100) / 100;

    // Mark cancelled in DB before touching Stripe.
    await updateEntry(entry.id, {
      status: 'cancelled',
      cancellation_reason: 'no_show',
      penalty_amount: penaltyAmount > 0 ? penaltyAmount.toFixed(2) : null,
    });

    // Stripe: capture → partial refund → distribute penalty.
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
            Math.round(refundedAmount * 100)
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

    await notifyEntry({
      entryId: entry.id,
      userId: entry.user_id,
      stationId: entry.station_id,
      type: 'queue_no_show',
      payload: { penaltyAmount, refundedAmount },
    });
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
