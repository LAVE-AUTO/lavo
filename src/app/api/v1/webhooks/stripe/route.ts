/**
 * POST /api/v1/webhooks/stripe
 * Stripe webhook handler for payment events.
 * Validates signature, then dispatches to the appropriate handler.
 *
 * Payment flow with capture_method: 'manual':
 *   1. Client confirms payment on frontend → Stripe authorizes (blocks) the funds.
 *   2. payment_intent.amount_capturable_updated → reservation confirmed (funds blocked, not yet captured).
 *   3. Station marks service complete (or cron detects late client) → our code calls capture().
 *   4. payment_intent.succeeded → fires after capture; funds distributed. No action needed here.
 *
 * Handled events:
 * - payment_intent.amount_capturable_updated → confirm reservation (status: confirmed)
 * - payment_intent.payment_failed → cancel reservation, decrement booked_count
 * - payment_intent.canceled → cancel reservation, decrement booked_count
 * - payment_intent.succeeded → no-op (capture already handled by service layer)
 */
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import {
  findEntryByStripePaymentId,
  confirmEntryIfPendingPayment,
  updateEntry,
} from '@/server/reservations/entry-repository';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';
import { notifyEntry } from '@/server/notifications/notification-service';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request): Promise<NextResponse> {
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Stripe webhook signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // On infrastructure errors (DB failures), return 500 so Stripe retries automatically.
  // Handlers are idempotent: they check entry status before acting, so retries are safe.
  // Expected non-error cases (entry not found, wrong status) are handled with early returns — no throw.
  try {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated':
        await handlePaymentAuthorized(event.data.object.id);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentCancelled(event.data.object.id, 'Payment failed');
        break;
      case 'payment_intent.canceled':
        await handlePaymentCancelled(event.data.object.id, 'Payment cancelled');
        break;
      case 'payment_intent.succeeded':
        // Fired after our manual capture — distribution is already handled by Stripe.
        // No action needed; captured as a no-op for observability.
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', event.type, err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * Confirms the reservation when the client's card authorization succeeds.
 * Fires on payment_intent.amount_capturable_updated — funds are blocked on the client's card
 * but not yet captured. Capture happens later when the station marks the service complete.
 */
async function handlePaymentAuthorized(paymentIntentId: string): Promise<void> {
  const entry = await findEntryByStripePaymentId(paymentIntentId);
  if (!entry) {
    console.warn(`Webhook: no entry found for PaymentIntent ${paymentIntentId}`);
    return;
  }

  const updated = await confirmEntryIfPendingPayment(entry.id);
  if (!updated) return;

  try {
    await notifyEntry({
      entryId: entry.id,
      userId: entry.user_id,
      stationId: entry.station_id,
      type: 'reservation_confirmed',
    });
  } catch (err) {
    console.error('Webhook: notification failed for reservation_confirmed', entry.id, err);
  }
}

/**
 * Cancels the reservation when the payment fails or is cancelled by Stripe.
 * Sets status to 'cancelled' and decrements slot booked_count atomically.
 */
async function handlePaymentCancelled(paymentIntentId: string, reason: string): Promise<void> {
  const entry = await findEntryByStripePaymentId(paymentIntentId);
  if (!entry) {
    console.warn(`Webhook: no entry found for PaymentIntent ${paymentIntentId}`);
    return;
  }

  if (!['pending_payment', 'confirmed'].includes(entry.status)) return;

  await db.transaction(async (tx) => {
    await updateEntry(entry.id, {
      status: 'cancelled',
      cancellation_reason: reason,
    }, tx);

    if (entry.time_slot_id) {
      await decrementSlotBookedCount(entry.time_slot_id, tx);
    }
  });

  try {
    await notifyEntry({
      entryId: entry.id,
      userId: entry.user_id,
      stationId: entry.station_id,
      type: 'entry_cancelled',
    });
  } catch (err) {
    console.error('Webhook: notification failed for payment_failed', entry.id, err);
  }
}
