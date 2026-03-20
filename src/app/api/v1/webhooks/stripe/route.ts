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
import { eq } from 'drizzle-orm';
import {
  findEntryByStripePaymentId,
  confirmEntryIfPendingPayment,
  updateEntry,
  setStripeTransferIdIfMissing,
  setStripePaymentSucceededAtIfMissing,
  setStripePaymentSucceededNotifiedAtIfMissing,
} from '@/server/reservations/entry-repository';
import { stations, users } from '@/lib/db/schema';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';
import { notifyEntry } from '@/server/notifications/notification-service';
import { sendPushNotification } from '@/server/notifications/fcm-service';
import { getPlatformSetting } from '@/server/admin/platform-settings-service';

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
      case 'transfer.created':
        await handleTransferCreated(event.data.object);
        break;
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
        await handlePaymentSucceeded(event.data.object.id, event.data.object.created);
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

function isTrueSetting(value: string | null): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/**
 * Maps Stripe transfer.created to the corresponding reservation (via transfer.metadata).
 * Stores reservations.stripe_transfer_id idempotently.
 *
 * We ensure metadata propagation by setting transfer_data.metadata in createPaymentIntent.
 */
async function handleTransferCreated(transfer: any): Promise<void> {
  const transferId = transfer?.id;
  const reservationId = transfer?.metadata?.reservation_id;
  if (typeof transferId !== 'string') return;
  if (typeof reservationId !== 'string') {
    console.warn('[WEBHOOK transfer.created] Missing transfer.metadata.reservation_id', {
      transferId,
    });
    return;
  }

  await setStripeTransferIdIfMissing(reservationId, transferId);
}

/**
 * Sends escrow finalization notifications after capture succeeds:
 * - Client push: invitation_to_rate
 * - Optional station/admin push based on platform settings
 *
 * Idempotence:
 * - sets stripe_payment_succeeded_at once
 * - sends notifications only once via stripe_payment_succeeded_notified_at
 */
async function handlePaymentSucceeded(paymentIntentId: string, created: number | undefined): Promise<void> {
  const entry = await findEntryByStripePaymentId(paymentIntentId);
  if (!entry) {
    console.warn(`Webhook: no entry found for PaymentIntent ${paymentIntentId}`);
    return;
  }

  const succeededAt = new Date(
    typeof created === 'number' ? created * 1000 : Date.now()
  );

  await setStripePaymentSucceededAtIfMissing(entry.id, succeededAt);

  // Only notify on the moment the station has marked the service complete.
  if (entry.status !== 'completed') return;

  const shouldNotify = await setStripePaymentSucceededNotifiedAtIfMissing(
    entry.id,
    succeededAt
  );
  if (!shouldNotify) return;

  // Notifications should not fail the webhook handler.
  try {
    await notifyEntry({
      entryId: entry.id,
      userId: entry.user_id,
      stationId: entry.station_id,
      type: 'invitation_to_rate',
    });
  } catch (err) {
    console.error('[WEBHOOK payment_intent.succeeded] Client notification failed', err);
  }

  // Optional station/admin push (platform settings)
  const stationPushEnabled = isTrueSetting(
    await getPlatformSetting('enable_station_push_on_escrow_released')
  );
  const adminPushEnabled = isTrueSetting(
    await getPlatformSetting('enable_admin_push_on_escrow_released')
  );

  if (stationPushEnabled) {
    try {
      const station = await db.query.stations.findFirst({
        where: eq(stations.id, entry.station_id),
        columns: { user_id: true },
      });

      if (station?.user_id) {
        await sendPushNotification(station.user_id, {
          title: 'Service completed',
          body: 'Payment captured and escrow released successfully.',
          data: { entry_id: entry.id, station_id: entry.station_id, type: 'escrow_released' },
        });
      }
    } catch (err) {
      console.error('[WEBHOOK payment_intent.succeeded] Station notification failed', err);
    }
  }

  if (adminPushEnabled) {
    try {
      const adminUsers = await db.query.users.findMany({
        where: eq(users.role, 'admin'),
        columns: { id: true },
      });

      for (const adminUser of adminUsers) {
        await sendPushNotification(adminUser.id, {
          title: 'Escrow released',
          body: 'A reservation escrow has been released successfully.',
          data: { entry_id: entry.id, station_id: entry.station_id, type: 'escrow_released_admin' },
        });
      }
    } catch (err) {
      console.error('[WEBHOOK payment_intent.succeeded] Admin notification failed', err);
    }
  }
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
