/**
 * Stripe Billing for station subscriptions.
 *
 * A station whose billing_model is 'subscription' pays a recurring fee to the
 * platform (instead of per-transaction commission). This service owns the Stripe
 * side: a shared Product, a per-station Customer, a Checkout Session (mode
 * subscription) to collect the card and start the subscription, and a sync from
 * Stripe webhook events into the `station_subscriptions` row.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { settings, stationSubscriptions, stations, users } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { getStationBillingModel, getSubscriptionPlans } from '@/server/admin/subscription-service';

const PRODUCT_SETTING_KEY = 'stripe_subscription_product_id';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hurryline.com';

export type SubscriptionInterval = 'month' | 'year';

export type StationSubscription = typeof stationSubscriptions.$inferSelect;

export async function getStationSubscription(stationId: string): Promise<StationSubscription | null> {
  const row = await db.query.stationSubscriptions.findFirst({
    where: eq(stationSubscriptions.station_id, stationId),
  });
  return row ?? null;
}

/** Returns the shared Stripe Product id for station subscriptions, creating it once. */
async function ensureSubscriptionProduct(): Promise<string> {
  const existing = await db.query.settings.findFirst({
    where: and(eq(settings.type, 'admin'), isNull(settings.entity_id), eq(settings.key, PRODUCT_SETTING_KEY)),
  });
  if (existing?.value) return existing.value;

  const product = await stripe.products.create({
    name: 'Hurryline — Abonnement station',
    metadata: { kind: 'station_subscription' },
  });
  await db
    .insert(settings)
    .values({ type: 'admin', key: PRODUCT_SETTING_KEY, value: product.id, entity_id: null, updated_at: new Date() })
    .onConflictDoUpdate({
      target: [settings.type, settings.key],
      targetWhere: isNull(settings.entity_id),
      set: { value: sql`excluded.value`, updated_at: sql`NOW()` },
    });
  return product.id;
}

/** Gets or creates the Stripe Customer for a station (on the platform account). */
async function ensureStripeCustomer(stationId: string, existing: StationSubscription | null): Promise<string> {
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const row = await db
    .select({ name: stations.name, email: users.email })
    .from(stations)
    .leftJoin(users, eq(users.id, stations.user_id))
    .where(eq(stations.id, stationId))
    .limit(1);
  const station = row[0];
  if (!station) throw new NotFoundError('Station not found');

  const customer = await stripe.customers.create({
    name: station.name,
    email: station.email ?? undefined,
    metadata: { station_id: stationId, kind: 'station_subscription' },
  });
  return customer.id;
}

/**
 * Starts (or restarts) a station subscription: validates the assigned plan,
 * creates a Stripe Checkout Session (mode subscription) to collect the card,
 * upserts a local row in `incomplete` status, and returns the Checkout URL.
 */
export async function createSubscriptionCheckout(
  stationId: string,
  interval: SubscriptionInterval,
  locale: string,
): Promise<{ url: string }> {
  const billing = await getStationBillingModel(stationId);
  if (billing.model !== 'subscription') {
    throw new ValidationError('This station is not set to subscription billing');
  }
  const plans = await getSubscriptionPlans();
  const plan = plans.find((p) => p.id === billing.plan_id && p.is_active);
  if (!plan) throw new ValidationError('Assigned subscription plan not found or inactive');

  const amount = interval === 'year' ? plan.annual_price : plan.monthly_price;
  if (amount == null || amount <= 0) throw new ValidationError('This plan has no price for the chosen interval');

  const existing = await getStationSubscription(stationId);
  const productId = await ensureSubscriptionProduct();
  const customerId = await ensureStripeCustomer(stationId, existing);

  const safeLocale = locale === 'en' ? 'en' : 'fr';
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'cad',
          product: productId,
          unit_amount: Math.round(amount * 100),
          recurring: { interval },
        },
      },
    ],
    success_url: `${APP_URL}/${safeLocale}/station/dashboard?subscription=success`,
    cancel_url: `${APP_URL}/${safeLocale}/station/dashboard?subscription=cancelled`,
    metadata: { station_id: stationId, plan_id: plan.id },
    subscription_data: { metadata: { station_id: stationId, plan_id: plan.id } },
  });

  // Upsert the local row in `incomplete` — the webhook flips it to active on payment.
  await db
    .insert(stationSubscriptions)
    .values({
      station_id: stationId,
      plan_id: plan.id,
      plan_name: plan.name,
      interval,
      amount: amount.toFixed(2),
      stripe_customer_id: customerId,
      status: 'incomplete',
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: stationSubscriptions.station_id,
      set: {
        plan_id: plan.id,
        plan_name: plan.name,
        interval,
        amount: amount.toFixed(2),
        stripe_customer_id: customerId,
        status: 'incomplete',
        pending_decision_at: null,
        admin_decision: null,
        warn_email_sent_at: null,
        updated_at: sql`NOW()`,
      },
    });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return { url: session.url };
}

/**
 * Reconciles a Stripe subscription object into the local row. Called by the
 * webhook on customer.subscription.* and invoice.* events.
 */
/** Stripe statuses that mean the subscription is no longer active → admin must decide. */
const TERMINAL_STATUSES = new Set(['canceled', 'unpaid', 'incomplete_expired']);

export async function syncSubscriptionFromStripe(sub: Stripe.Subscription): Promise<void> {
  const stationId = sub.metadata?.station_id;
  if (!stationId) return;

  const existing = await getStationSubscription(stationId);
  if (!existing) return;

  const periodEnd = sub.items?.data?.[0]?.current_period_end ?? null;
  const isTerminal = TERMINAL_STATUSES.has(sub.status);

  await db
    .update(stationSubscriptions)
    .set({
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000) : existing.current_period_end,
      // When the subscription ends, open the admin decision window (suspend vs
      // commission) — but only once, and only while no decision has been taken.
      pending_decision_at:
        isTerminal && !existing.admin_decision && !existing.pending_decision_at
          ? new Date()
          : existing.pending_decision_at,
      // A fresh active subscription clears any prior decision window.
      ...(sub.status === 'active' ? { pending_decision_at: null, admin_decision: null, warn_email_sent_at: null } : {}),
      updated_at: new Date(),
    })
    .where(eq(stationSubscriptions.station_id, stationId));
}

/** Looks up the Stripe subscription for a given invoice and syncs it locally. */
export async function syncSubscriptionFromInvoice(subscriptionId: string | null | undefined): Promise<void> {
  if (!subscriptionId) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionFromStripe(sub);
}
