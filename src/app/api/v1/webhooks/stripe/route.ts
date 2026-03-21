/**
 * POST `/api/v1/webhooks/stripe` — signature verification, then idempotent handlers.
 * Manual capture: authorize → confirm entry → capture on completion → `succeeded` (push + success email).
 * Events: `amount_capturable_updated`, `payment_failed` / `canceled`, `succeeded`, `transfer.created`.
 */
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { sendPaymentFailedEmail, sendPaymentSuccessEmail } from '@/lib/email';
import {
  cancelEntryForStripePaymentFailureIfEligible,
  confirmEntryIfPendingPayment,
  findEntryByStripePaymentId,
  setStripePaymentSucceededAtIfMissing,
  setStripePaymentSucceededNotifiedAtIfMissing,
  setStripeTransferIdIfMissing,
} from '@/server/reservations/entry-repository';
import { stations, users } from '@/lib/db/schema';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';
import { notifyEntry } from '@/server/notifications/notification-service';
import { sendPushNotification } from '@/server/notifications/fcm-service';
import { getPlatformSetting, isAdminEscrowPushEnabled } from '@/server/admin/platform-settings-service';




const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_ID_PATTERN = /^[a-zA-Z0-9_]+$/;
const OPAQUE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;


// %%%%% ROUTE — POST handler %%%%%
// Verifies Stripe signature; dispatches by event type; 500 only on infra errors (Stripe retries).

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

  let event: Stripe.Event;
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

      case 'payment_intent.amount_capturable_updated': {
        const pi = sanitizeStripeId((event.data.object as { id?: unknown })?.id, 'pi_');
        if (!pi) {
          console.warn('[WEBHOOK] Ignoring payment_intent event: invalid or missing id');
          break;
        }
        await handlePaymentAuthorized(pi);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = sanitizeStripeId((event.data.object as { id?: unknown })?.id, 'pi_');
        if (!pi) {
          console.warn('[WEBHOOK] Ignoring payment_intent.payment_failed: invalid or missing id');
          break;
        }
        await handlePaymentCancelled(pi, 'Payment failed');
        break;
      }

      case 'payment_intent.canceled': {
        const pi = sanitizeStripeId((event.data.object as { id?: unknown })?.id, 'pi_');
        if (!pi) {
          console.warn('[WEBHOOK] Ignoring payment_intent.canceled: invalid or missing id');
          break;
        }
        await handlePaymentCancelled(pi, 'Payment cancelled');
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = sanitizeStripeId((event.data.object as { id?: unknown })?.id, 'pi_');
        if (!pi) {
          console.warn('[WEBHOOK] Ignoring payment_intent.succeeded: invalid or missing id');
          break;
        }
        await handlePaymentSucceeded(
          pi,
          typeof event.data.object?.created === 'number' ? event.data.object.created : undefined
        );
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('Stripe webhook handler error:', { eventType: event.type, error });
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}


// %%%%% END - ROUTE — POST handler %%%%%


// %%%%% MODULE — ID sanitizers %%%%%
// Stripe and opaque IDs for logs and DB lookups.

function isTrueSetting(value: string | null): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function sanitizeStripeId(value: unknown, expectedPrefix?: string): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 255) return null;
  if (!STRIPE_ID_PATTERN.test(normalized)) return null;
  if (expectedPrefix && !normalized.startsWith(expectedPrefix)) return null;
  return normalized;
}

function sanitizeOpaqueId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 128) return null;
  return OPAQUE_ID_PATTERN.test(normalized) ? normalized : null;
}


// %%%%% END - MODULE — ID sanitizers %%%%%


// %%%%% HANDLER — transfer.created %%%%%
// Maps transfer to reservation: metadata.reservation_id, else charge → payment_intent → entry.

/** Persists `stripe_transfer_id` idempotently; logs and returns on missing mapping. */
async function handleTransferCreated(transfer: Stripe.Transfer | Record<string, unknown>): Promise<void> {
  const transferId = sanitizeStripeId((transfer as { id?: unknown })?.id, 'tr_');
  if (!transferId) return;

  const metadata = (transfer as { metadata?: { reservation_id?: unknown } })?.metadata;
  const reservationIdFromMetadata = sanitizeOpaqueId(metadata?.reservation_id);
  if (reservationIdFromMetadata) {
    await setStripeTransferIdIfMissing(reservationIdFromMetadata, transferId);
    return;
  }

  const sourceTransactionId = sanitizeStripeId(
    (transfer as { source_transaction?: unknown })?.source_transaction,
    'ch_'
  );
  if (!sourceTransactionId) {
    console.warn('[WEBHOOK transfer.created] Missing mapping data: metadata.reservation_id and source_transaction', {
      transferId,
    });
    return;
  }

  try {
    const charge = await stripe.charges.retrieve(sourceTransactionId);
    const piRaw = charge.payment_intent;
    const paymentIntentId =
      typeof piRaw === 'string'
        ? sanitizeStripeId(piRaw, 'pi_')
        : piRaw && typeof piRaw === 'object' && piRaw !== null && 'id' in piRaw
          ? sanitizeStripeId((piRaw as { id: unknown }).id, 'pi_')
          : null;

    if (!paymentIntentId) {
      console.warn('[WEBHOOK transfer.created] Charge has no payment_intent', {
        transferId,
        sourceTransactionId,
      });
      return;
    }

    const entry = await findEntryByStripePaymentId(paymentIntentId);
    if (!entry) {
      console.warn('[WEBHOOK transfer.created] No reservation found for payment_intent', {
        transferId,
        paymentIntentId,
      });
      return;
    }

    await setStripeTransferIdIfMissing(entry.id, transferId);
  } catch (err) {
    console.error('[WEBHOOK transfer.created] Fallback mapping failed; acking without retry', {
      transferId,
      sourceTransactionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}


// %%%%% END - HANDLER — transfer.created %%%%%


// %%%%% HANDLER — payment_intent.succeeded %%%%%
// Idempotent: succeeded_at + notified_at; client push, success email, optional station/admin push.

/** When entry is `completed`, notifies once and sends transactional success email. */
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
    const error = err instanceof Error ? err.message : String(err);
    console.error('[WEBHOOK payment_intent.succeeded] Client notification failed', { error });
  }

  try {
    const userRow = await db.query.users.findFirst({
      where: eq(users.id, entry.user_id),
      columns: { email: true },
    });
    const emailTo = userRow?.email?.trim();
    if (emailTo) {
      const stationRow = await db.query.stations.findFirst({
        where: eq(stations.id, entry.station_id),
        columns: { name: true },
      });
      await sendPaymentSuccessEmail({
        to: emailTo,
        stationName: stationRow?.name,
        entryId: entry.id,
      });
    }
  } catch {
    // Do not log provider/DB error bodies (may echo recipient or other PII).
    console.error('[WEBHOOK payment_intent.succeeded] Client success email failed');
  }

  // Optional station/admin push (platform settings)
  const stationPushEnabled = isTrueSetting(
    await getPlatformSetting('enable_station_push_on_escrow_released')
  );
  const adminPushEnabled = await isAdminEscrowPushEnabled();

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
      const error = err instanceof Error ? err.message : String(err);
      console.error('[WEBHOOK payment_intent.succeeded] Station notification failed', { error });
    }
  }

  if (adminPushEnabled) {
    try {
      const adminUsers = await db.query.users.findMany({
        where: eq(users.role, 'admin'),
        columns: { id: true },
      });

      for (const adminUser of adminUsers ?? []) {
        await sendPushNotification(adminUser.id, {
          title: 'Escrow released',
          body: 'A reservation escrow has been released successfully.',
          data: { entry_id: entry.id, station_id: entry.station_id, type: 'escrow_released_admin' },
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[WEBHOOK payment_intent.succeeded] Admin notification failed', { error });
    }
  }
}


// %%%%% END - HANDLER — payment_intent.succeeded %%%%%


// %%%%% HANDLER — payment_intent.amount_capturable_updated %%%%%
// Confirms pending_payment entry after card authorization (funds held, not captured).

/** Confirms reservation; push `reservation_confirmed`. */
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
    const error = err instanceof Error ? err.message : String(err);
    console.error('Webhook: notification failed for reservation_confirmed', { entryId: entry.id, error });
  }
}


// %%%%% END - HANDLER — payment_intent.amount_capturable_updated %%%%%


// %%%%% HANDLER — payment_intent failed / canceled %%%%%
// Cancels entry, decrements slot, push + failure email.

/** Cancels eligible entry and notifies client (push + email). */
async function handlePaymentCancelled(paymentIntentId: string, reason: string): Promise<void> {
  const entry = await findEntryByStripePaymentId(paymentIntentId);
  if (!entry) {
    console.warn(`Webhook: no entry found for PaymentIntent ${paymentIntentId}`);
    return;
  }

  let cancelled: Awaited<ReturnType<typeof cancelEntryForStripePaymentFailureIfEligible>> | undefined;
  await db.transaction(async (tx) => {
    cancelled = await cancelEntryForStripePaymentFailureIfEligible(entry.id, reason, tx);
    if (cancelled?.time_slot_id) {
      await decrementSlotBookedCount(cancelled.time_slot_id, tx);
    }
  });

  if (!cancelled) return;

  try {
    await notifyEntry({
      entryId: cancelled.id,
      userId: cancelled.user_id,
      stationId: cancelled.station_id,
      type: 'entry_cancelled',
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('Webhook: notification failed for payment_failed', { entryId: cancelled.id, error });
  }

  try {
    const userRow = await db.query.users.findFirst({
      where: eq(users.id, cancelled.user_id),
      columns: { email: true },
    });
    const emailTo = userRow?.email?.trim();
    if (emailTo) {
      await sendPaymentFailedEmail({ to: emailTo, reason });
    }
  } catch {
    console.error('[WEBHOOK payment_intent cancel/fail] Client failure email failed', {
      entryId: cancelled.id,
    });
  }
}


// %%%%% END - HANDLER — payment_intent failed / canceled %%%%%
