/**
 * POST /api/v1/webhooks/stripe
 * Stripe webhook handler for payment events.
 * Validates signature, then dispatches to the appropriate handler.
 *
 * Handled events:
 * - payment_intent.succeeded → confirm reservation (status: confirmed)
 * - payment_intent.payment_failed → cancel reservation, decrement booked_count
 */
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import {
  findEntryByStripePaymentId,
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

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object.id);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object.id);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

/**
 * Confirms the reservation when payment succeeds.
 * Sets status to 'confirmed' and records confirmed_at timestamp.
 */
async function handlePaymentSucceeded(paymentIntentId: string): Promise<void> {
  const entry = await findEntryByStripePaymentId(paymentIntentId);
  if (!entry) {
    console.warn(`Webhook: no entry found for PaymentIntent ${paymentIntentId}`);
    return;
  }

  if (entry.status !== 'pending_payment') return;

  await updateEntry(entry.id, {
    status: 'confirmed',
    confirmed_at: new Date(),
  });

  await notifyEntry({
    entryId: entry.id,
    userId: entry.user_id,
    stationId: entry.station_id,
    type: 'reservation_confirmed',
  });
}

/**
 * Cancels the reservation when payment fails.
 * Sets status to 'cancelled' and decrements slot booked_count.
 */
async function handlePaymentFailed(paymentIntentId: string): Promise<void> {
  const entry = await findEntryByStripePaymentId(paymentIntentId);
  if (!entry) {
    console.warn(`Webhook: no entry found for PaymentIntent ${paymentIntentId}`);
    return;
  }

  if (entry.status !== 'pending_payment') return;

  await updateEntry(entry.id, {
    status: 'cancelled',
    cancellation_reason: 'Payment failed',
  });

  if (entry.time_slot_id) {
    await decrementSlotBookedCount(entry.time_slot_id);
  }

  await notifyEntry({
    entryId: entry.id,
    userId: entry.user_id,
    stationId: entry.station_id,
    type: 'payment_failed',
  });
}
