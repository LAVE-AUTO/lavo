/**
 * POST `/api/v1/webhooks/stripe` - signature verification, then idempotent handlers.
 * Manual capture: authorize → confirm entry → capture on completion → `succeeded` (push + success email).
 * Events: `amount_capturable_updated`, `payment_failed` / `canceled`, `succeeded`, `transfer.created`.
 */
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { sendPaymentFailedEmail } from '@/lib/email';
import { error400, errorResponse, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import {
  cancelEntryForStripePaymentFailureIfEligible,
  cancelEntryForStripeIntentCancelIfEligible,
  clearStripePaymentSucceededNotifiedAt,
  confirmEntryIfPendingPayment,
  findEntryByStripePaymentId,
  setStripePaymentSucceededAtIfMissing,
  setStripePaymentSucceededNotifiedAtIfMissing,
  setStripeTransferIdIfMissing,
} from '@/server/reservations/entry-repository';
import { users } from '@/lib/db/schema';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';
import { notifyEntry } from '@/server/notifications/notification-service';
import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';
import { notifyStationFeed } from '@/server/notifications/station-feed-notifications';
import { sendEscrowReleasedNotificationsForEntry } from '@/server/notifications/escrow-released-notifications';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_ID_PATTERN = /^[a-zA-Z0-9_]+$/;
const OPAQUE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;


// %%%%% ROUTE - POST handler %%%%%
// Verifies Stripe signature; dispatches by event type; 500 only on infra errors (Stripe retries).

export async function POST(request: Request): Promise<NextResponse> {
  if (!webhookSecret) {
    // CRITICAL: every Stripe webhook call returns 500 until this is fixed.
    // Stripe will retry for 72h then disable the endpoint, leaving ALL paid
    // reservations stuck in pending_payment. Fix by setting STRIPE_WEBHOOK_SECRET.
    console.error('[STRIPE_WEBHOOK] CRITICAL — STRIPE_WEBHOOK_SECRET is not configured. All webhook events are being dropped. Set STRIPE_WEBHOOK_SECRET immediately to prevent stuck reservations.', {
      timestamp: new Date().toISOString(),
    });
    return errorResponse('Webhook not configured', 500, { code: ApiCode.INTERNAL_ERROR });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return error400('Missing stripe-signature header');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Stripe webhook signature verification failed:', message);
    return error400('Invalid signature');
  }

  // On infrastructure errors (DB failures), return 500 so Stripe retries automatically.
  // Handlers are idempotent: they check entry status before acting, so retries are safe.
  // Expected non-error cases (entry not found, wrong status) are handled with early returns - no throw.
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
        await handleIntentCancelled(pi, 'Payment cancelled');
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
    return error500(err);
  }

  return NextResponse.json({ received: true });
}


// %%%%% END - ROUTE - POST handler %%%%%


// %%%%% MODULE - ID sanitizers %%%%%
// Stripe and opaque IDs for logs and DB lookups.

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


// %%%%% END - MODULE - ID sanitizers %%%%%


// %%%%% HANDLER - transfer.created %%%%%
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

  // Re-throw here so the outer try/catch returns 500 → Stripe retries automatically.
  // Swallowing DB errors would silently lose the transfer_id mapping.
  const charge = await stripe.charges.retrieve(sourceTransactionId);
  const piRaw = charge.payment_intent;
  const paymentIntentId =
    typeof piRaw === 'string'
      ? sanitizeStripeId(piRaw, 'pi_')
      : piRaw && typeof piRaw === 'object' && piRaw !== null && 'id' in piRaw
        ? sanitizeStripeId((piRaw as { id: unknown }).id, 'pi_')
        : null;

  if (!paymentIntentId) {
    console.warn('[WEBHOOK transfer.created] Charge has no payment_intent — cannot map transfer', {
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
}


// %%%%% END - HANDLER - transfer.created %%%%%


// %%%%% HANDLER - payment_intent.succeeded %%%%%
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

  // Re-fetch after writing succeeded_at to catch races where the station marked the entry
  // as 'completed' between our initial findEntryByStripePaymentId and now. Without this
  // re-fetch, the entry.status snapshot is stale and we would skip notifying a freshly
  // completed reservation (bug #5).
  const fresh = await findEntryByStripePaymentId(paymentIntentId);
  if (!fresh || fresh.status !== 'completed') return;

  const shouldNotify = await setStripePaymentSucceededNotifiedAtIfMissing(
    fresh.id,
    succeededAt
  );
  if (!shouldNotify) return;

  try {
    await sendEscrowReleasedNotificationsForEntry(fresh, succeededAt);
  } catch (err) {
    // Wrap the clear in its own try/catch so a DB failure here does not mask the original
    // notification error (bug #20). If both fail, log the second error explicitly.
    try {
      await clearStripePaymentSucceededNotifiedAt(fresh.id);
    } catch (clearErr) {
      console.error('[WEBHOOK payment_intent.succeeded] CRITICAL: failed to clear notified_at after notification failure — escrow notification will not retry', {
        entryId: fresh.id,
        clearError: clearErr instanceof Error ? clearErr.message : String(clearErr),
      });
    }
    const error = err instanceof Error ? err.message : String(err);
    console.error('[WEBHOOK payment_intent.succeeded] Escrow released notifications failed', { error });
    throw err;
  }
}


// %%%%% END - HANDLER - payment_intent.succeeded %%%%%


// %%%%% HANDLER - payment_intent.amount_capturable_updated %%%%%
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
    await notifyClientFeed({
      userId: entry.user_id,
      entryId: entry.id,
      stationId: entry.station_id,
      kind: 'reservation_confirmed',
      body: 'Votre réservation est confirmée. À bientôt !',
    });
    // Notify the station only after payment is confirmed — not at creation time,
    // since pending_payment entries may never complete (card declined, timeout).
    const clientRow = await db.query.users.findFirst({
      where: eq(users.id, entry.user_id),
      columns: { first_name: true },
    });
    const clientName = clientRow?.first_name ?? 'Un client';
    await notifyStationFeed({
      stationId: entry.station_id,
      entryId: entry.id,
      kind: 'reservation_new',
      body: `${clientName} a réservé un créneau (${parseFloat(entry.amount_paid).toFixed(2)} $)`,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('Webhook: notification failed for reservation_confirmed', { entryId: entry.id, error });
  }
}


// %%%%% END - HANDLER - payment_intent.amount_capturable_updated %%%%%


// %%%%% HANDLER - payment_intent failed / canceled %%%%%
// Cancels entry, decrements slot, push + failure email.

/**
 * payment_intent.payment_failed — targets pending_payment only.
 * confirmed entries are intentionally skipped: a late payment_failed retry
 * (3DS timeout, network glitch) must not override an authorization that
 * already succeeded.
 */
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
    await notifyClientFeed({
      userId: cancelled.user_id,
      entryId: cancelled.id,
      stationId: cancelled.station_id,
      kind: 'entry_cancelled',
      body: 'Votre réservation a été annulée.',
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
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[WEBHOOK payment_intent cancel/fail] Client failure email failed', {
      entryId: cancelled.id,
      error,
    });
  }
}


/**
 * payment_intent.canceled — explicit revocation of the intent.
 * Also targets confirmed entries: once an intent is canceled, the card hold
 * is released by Stripe and no capture can ever happen, so the reservation
 * must be cancelled regardless of whether the authorization had succeeded.
 */
async function handleIntentCancelled(paymentIntentId: string, reason: string): Promise<void> {
  const entry = await findEntryByStripePaymentId(paymentIntentId);
  if (!entry) {
    console.warn(`Webhook: no entry found for PaymentIntent ${paymentIntentId}`);
    return;
  }

  let cancelled: Awaited<ReturnType<typeof cancelEntryForStripeIntentCancelIfEligible>> | undefined;
  await db.transaction(async (tx) => {
    cancelled = await cancelEntryForStripeIntentCancelIfEligible(entry.id, reason, tx);
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
    await notifyClientFeed({
      userId: cancelled.user_id,
      entryId: cancelled.id,
      stationId: cancelled.station_id,
      kind: 'entry_cancelled',
      body: 'Votre réservation a été annulée.',
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('Webhook: notification failed for payment_intent.canceled', { entryId: cancelled.id, error });
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
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[WEBHOOK payment_intent.canceled] Client failure email failed', {
      entryId: cancelled.id,
      error,
    });
  }
}

// %%%%% END - HANDLER - payment_intent failed / canceled %%%%%
