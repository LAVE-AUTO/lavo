/**
 * Stripe Billing for station subscriptions.
 *
 * A station whose billing_model is 'subscription' pays a recurring fee to the
 * platform (instead of per-transaction commission). This service owns the Stripe
 * side: a shared Product, a per-station Customer, a Checkout Session (mode
 * subscription) to collect the card and start the subscription, and a sync from
 * Stripe webhook events into the `station_subscriptions` row.
 */
import { and, eq, gte, isNull, isNotNull, lte, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { settings, stationSubscriptions, stations, users } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';
import {
  getStationBillingModel,
  getSubscriptionPlans,
  setStationBillingModel,
} from '@/server/admin/subscription-service';
import {
  sendSubscriptionDecisionRequiredEmail,
  sendSubscriptionExpiryWarningEmail,
} from '@/lib/email';

const PRODUCT_SETTING_KEY = 'stripe_subscription_product_id';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hurryline.com';

/** Days before expiry at which the J-7 warning email goes out. */
export const SUBSCRIPTION_WARN_DAYS = 7;
/** Hours the admin has to decide (suspend vs commission) before auto-commission kicks in. */
export const SUBSCRIPTION_DECISION_GRACE_HOURS = 10;

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
  /* The decision window opens exactly once: when the subscription first ends
   * and no decision has yet been taken. We send the admin email on that edge. */
  const decisionJustOpened = isTerminal && !existing.admin_decision && !existing.pending_decision_at;

  await db
    .update(stationSubscriptions)
    .set({
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000) : existing.current_period_end,
      pending_decision_at: decisionJustOpened ? new Date() : existing.pending_decision_at,
      // A fresh active subscription clears any prior decision window.
      ...(sub.status === 'active' ? { pending_decision_at: null, admin_decision: null, warn_email_sent_at: null } : {}),
      updated_at: new Date(),
    })
    .where(eq(stationSubscriptions.station_id, stationId));

  if (decisionJustOpened) {
    /* Side-effect emails are swallowed so a transient send failure never makes
     * the webhook return 500 (which would re-run sync and, the window now being
     * open, skip the email entirely). */
    await dispatchDecisionRequiredEmails(stationId).catch((err) => {
      console.error('[subscription] decision-required email dispatch failed', {
        stationId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

/** Active admin recipients for subscription lifecycle notifications. */
async function getActiveAdminEmails(): Promise<string[]> {
  const rows = await db.query.users.findMany({
    where: and(eq(users.role, 'admin'), eq(users.status, 'active')),
    columns: { email: true },
  });
  return rows.map((r) => r.email).filter((e): e is string => Boolean(e));
}

/** Looks up the station display name (best-effort). */
async function getStationName(stationId: string): Promise<string> {
  const row = await db.query.stations.findFirst({
    where: eq(stations.id, stationId),
    columns: { name: true },
  });
  return row?.name ?? 'Station';
}

/** Emails every active admin that a station subscription ended and needs a decision. */
async function dispatchDecisionRequiredEmails(stationId: string): Promise<void> {
  const [admins, stationName] = await Promise.all([getActiveAdminEmails(), getStationName(stationId)]);
  await Promise.allSettled(
    admins.map((to) =>
      sendSubscriptionDecisionRequiredEmail({
        to,
        stationId,
        stationName,
        graceHours: SUBSCRIPTION_DECISION_GRACE_HOURS,
      }),
    ),
  );
}

/** Looks up the Stripe subscription for a given invoice and syncs it locally. */
export async function syncSubscriptionFromInvoice(subscriptionId: string | null | undefined): Promise<void> {
  if (!subscriptionId) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionFromStripe(sub);
}


// %%%%% Lifecycle (cron-driven) %%%%%

export interface ExpiringSubscriptionRow {
  id: string;
  station_id: string;
  station_name: string;
  owner_email: string | null;
  plan_name: string | null;
  current_period_end: Date | null;
}

/**
 * Active subscriptions whose period ends within `withinDays` and that have not
 * yet received the expiry warning email. Joined with station + owner email.
 */
export async function findSubscriptionsForExpiryWarning(withinDays: number): Promise<ExpiringSubscriptionRow[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  return db
    .select({
      id: stationSubscriptions.id,
      station_id: stationSubscriptions.station_id,
      station_name: stations.name,
      owner_email: users.email,
      plan_name: stationSubscriptions.plan_name,
      current_period_end: stationSubscriptions.current_period_end,
    })
    .from(stationSubscriptions)
    .innerJoin(stations, eq(stations.id, stationSubscriptions.station_id))
    .leftJoin(users, eq(users.id, stations.user_id))
    .where(
      and(
        eq(stationSubscriptions.status, 'active'),
        isNull(stationSubscriptions.warn_email_sent_at),
        isNotNull(stationSubscriptions.current_period_end),
        gte(stationSubscriptions.current_period_end, now),
        lte(stationSubscriptions.current_period_end, horizon),
      ),
    );
}

/** Anti-duplicate flag: stamps that the expiry warning email has been sent. */
export async function markWarnEmailSent(subscriptionId: string): Promise<void> {
  await db
    .update(stationSubscriptions)
    .set({ warn_email_sent_at: new Date(), updated_at: new Date() })
    .where(eq(stationSubscriptions.id, subscriptionId));
}

/**
 * Sends the J-7 expiry warning to the station owner AND active admins for every
 * subscription approaching expiry, then stamps the anti-duplicate flag.
 */
export async function runSubscriptionExpiryWarnings(withinDays: number): Promise<{ processed: number; emailed: number }> {
  const rows = await findSubscriptionsForExpiryWarning(withinDays);
  if (rows.length === 0) return { processed: 0, emailed: 0 };

  const adminEmails = await getActiveAdminEmails();
  let emailed = 0;

  for (const row of rows) {
    const expiry = row.current_period_end;
    if (!expiry) continue;
    const targets: Array<Promise<unknown>> = [];
    if (row.owner_email) {
      targets.push(
        sendSubscriptionExpiryWarningEmail({
          to: row.owner_email,
          stationName: row.station_name,
          planName: row.plan_name,
          expiryDate: expiry,
          isAdmin: false,
        }),
      );
    }
    for (const to of adminEmails) {
      targets.push(
        sendSubscriptionExpiryWarningEmail({
          to,
          stationName: row.station_name,
          planName: row.plan_name,
          expiryDate: expiry,
          isAdmin: true,
        }),
      );
    }
    await Promise.allSettled(targets);
    await markWarnEmailSent(row.id);
    emailed += 1;
  }

  return { processed: rows.length, emailed };
}

/**
 * Decision windows that have exceeded the grace period without an admin
 * decision → the platform auto-switches the station to commission billing.
 */
export async function runSubscriptionAutoCommission(graceHours: number): Promise<{ processed: number; switched: number }> {
  const cutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000);
  const rows = await db
    .select({ station_id: stationSubscriptions.station_id })
    .from(stationSubscriptions)
    .where(
      and(
        isNotNull(stationSubscriptions.pending_decision_at),
        isNull(stationSubscriptions.admin_decision),
        lte(stationSubscriptions.pending_decision_at, cutoff),
      ),
    );

  let switched = 0;
  for (const row of rows) {
    try {
      await setStationBillingModel(row.station_id, { model: 'commission' }, null);
      await db
        .update(stationSubscriptions)
        .set({ admin_decision: 'auto_commission', updated_at: new Date() })
        .where(eq(stationSubscriptions.station_id, row.station_id));
      switched += 1;
    } catch (err) {
      console.error('[subscription] auto-commission switch failed', {
        stationId: row.station_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { processed: rows.length, switched };
}

// %%%%% END - Lifecycle (cron-driven) %%%%%
