/**
 * One Stripe Billing subscription per station (when its billing_model is 'subscription').
 * Tracks the Stripe customer/subscription, status, current period end, and the
 * end-of-subscription admin decision lifecycle:
 *   - warn_email_sent_at: J-7 expiry warning sent to admin + station
 *   - pending_decision_at: subscription ended/unpaid; admin must choose suspend vs commission
 *   - admin_decision: 'suspend' | 'commission' (or null while pending)
 * If the admin doesn't decide within 10h of pending_decision_at, a cron falls back to commission.
 */
import {
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stations } from "./stations";

export const stationSubscriptions = pgTable(
  "station_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    /** The settings plan id this subscription is for. */
    plan_id: varchar("plan_id", { length: 64 }).notNull(),
    plan_name: varchar("plan_name", { length: 80 }),
    /** Billing interval: 'month' | 'year'. */
    interval: varchar("interval", { length: 10 }).notNull(),
    /** Snapshot of the plan amount at subscription time. */
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    stripe_customer_id: varchar("stripe_customer_id", { length: 100 }),
    stripe_subscription_id: varchar("stripe_subscription_id", { length: 100 }),
    /** Mirrors the Stripe subscription status (incomplete, active, past_due, canceled, unpaid, ended). */
    status: varchar("status", { length: 30 }).notNull().default("incomplete"),
    current_period_end: timestamp("current_period_end", { withTimezone: true, mode: "date" }),
    warn_email_sent_at: timestamp("warn_email_sent_at", { withTimezone: true, mode: "date" }),
    pending_decision_at: timestamp("pending_decision_at", { withTimezone: true, mode: "date" }),
    admin_decision: varchar("admin_decision", { length: 20 }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("station_subscriptions_station_id_unique").on(t.station_id)]
);
