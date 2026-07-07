/**
 * Reservations and no-show fees.
 * Booking lifecycle, queue, and financial snapshot; no-show fee records after queue switch.
 * Single table for both reservations (entry_type='reservation', time_slot_id set) and queue
 * (entry_type='queue', queue_position set). Constraints enforced in app: reservation => time_slot_id
 * NOT NULL; queue => queue_position NOT NULL.
 */
import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stations, stationPosts, vehicleFormats } from "./stations";
import { stationServices } from "./services";
import { timeSlots } from "./slots";
import { users } from "./users";

/** Entry type: reservation (slot) or queue. */
export const entryTypeEnum = pgEnum("entry_type", ["reservation", "queue"]);
export const bookingSourceEnum = pgEnum("booking_source", ["standard", "qr"]);

/** Reservation lifecycle, queue position, and payment snapshot. */
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entry_type: entryTypeEnum("entry_type").notNull().default("reservation"),
    booking_source: bookingSourceEnum("booking_source").notNull().default("standard"),
    time_slot_id: uuid("time_slot_id").references(() => timeSlots.id, {
      onDelete: "cascade",
    }),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    vehicle_format_id: uuid("vehicle_format_id")
      .references(() => vehicleFormats.id),
    /**
     * Snapshot of the station_services row picked at booking. Nullable so
     * legacy entries created before this column shipped keep working; new
     * entries set it via the booking endpoint. Used by /me/entries and
     * /history/client to surface the service name + category on cards and
     * receipts. ON DELETE SET NULL so deleting a service does not remove
     * historical entries.
     */
    service_id: uuid("service_id")
      .references(() => stationServices.id, { onDelete: "set null" }),
    /**
     * Walk-in client capture (manual add by the merchant). Filled only
     * when the entered email does NOT match any registered users row —
     * in that case user_id keeps the station owner placeholder and these
     * columns carry the actual end-customer identity so the completion
     * email can fire. Matched walk-ins set user_id to the real account
     * and leave these columns NULL.
     */
    walk_in_client_email: varchar("walk_in_client_email", { length: 320 }),
    walk_in_client_name: varchar("walk_in_client_name", { length: 200 }),
    /** Timestamp of the 'service done + register CTA' email sent to an
     *  unregistered walk-in client. Used to avoid double-sending. */
    walk_in_receipt_sent_at: timestamp("walk_in_receipt_sent_at", {
      mode: "date",
      withTimezone: true,
    }),
    /**
     * Wash bay assigned to this entry. Filled by the booking flow that
     * picks an available post for a given start_time. Nullable for queue
     * entries (no fixed time → no fixed bay) and legacy reservations
     * created before the per-post availability model.
     */
    post_id: uuid("post_id").references(() => stationPosts.id, { onDelete: "set null" }),
    status: varchar("status", { length: 30 }).notNull(),
    queue_position: integer("queue_position"),
    /**
     * 6-character service code shown to the client and required by the station
     * to start the service. Generated server-side on entry creation. Made of
     * digits + uppercase letters (no ambiguous chars).
     */
    ticket_code: varchar("ticket_code", { length: 6 }),
    amount_paid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
    commission_rate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull(),
    commission_amount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
    station_payout: decimal("station_payout", { precision: 10, scale: 2 }).notNull().default("0.00"),
    station_service_total: decimal("station_service_total", { precision: 10, scale: 2 }).notNull().default("0.00"),
    platform_service_fee: decimal("platform_service_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
    taxable_subtotal: decimal("taxable_subtotal", { precision: 10, scale: 2 }).notNull().default("0.00"),
    tps_amount: decimal("tps_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
    tvq_amount: decimal("tvq_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
    client_total: decimal("client_total", { precision: 10, scale: 2 }).notNull().default("0.00"),
    platform_subtotal: decimal("platform_subtotal", { precision: 10, scale: 2 }).notNull().default("0.00"),
    platform_tax_amount: decimal("platform_tax_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
    platform_total_retained: decimal("platform_total_retained", { precision: 10, scale: 2 }).notNull().default("0.00"),
    station_subtotal: decimal("station_subtotal", { precision: 10, scale: 2 }).notNull().default("0.00"),
    station_tax_amount: decimal("station_tax_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
    station_total_transferred: decimal("station_total_transferred", { precision: 10, scale: 2 }).notNull().default("0.00"),
    tip_amount: decimal("tip_amount", { precision: 10, scale: 2 }),
    stripe_payment_id: varchar("stripe_payment_id", { length: 200 }),
    stripe_charge_id: varchar("stripe_charge_id", { length: 200 }),
    stripe_transfer_id: varchar("stripe_transfer_id", { length: 200 }),
    stripe_refund_id: varchar("stripe_refund_id", { length: 200 }),
    stripe_payment_succeeded_at: timestamp("stripe_payment_succeeded_at", {
      mode: "date",
      withTimezone: true,
    }),
    stripe_payment_succeeded_notified_at: timestamp(
      "stripe_payment_succeeded_notified_at",
      {
        mode: "date",
        withTimezone: true,
      }
    ),
    client_confirmed: boolean("client_confirmed").notNull().default(false),
    cancellation_reason: text("cancellation_reason"),
    penalty_amount: decimal("penalty_amount", { precision: 10, scale: 2 }),
    /**
     * Set when cancelPaymentIntent() threw — the card hold may persist until the
     * Stripe-side authorization auto-expires (bug #12). The reconciliation cron
     * retries the cancel; on success this column is cleared back to NULL.
     */
    pi_cancel_failed_at: timestamp("pi_cancel_failed_at", {
      mode: "date",
      withTimezone: true,
    }),
    /**
     * Set when Stripe.refunds.create() succeeded but persisting stripe_refund_id on the row
     * failed (bug #26). The reconciliation cron looks up Stripe refunds by PI and writes the
     * id back; this column is cleared on success.
     */
    refund_persist_failed_at: timestamp("refund_persist_failed_at", {
      mode: "date",
      withTimezone: true,
    }),
    confirmed_at: timestamp("confirmed_at", {
      mode: "date",
      withTimezone: true,
    }),
    completed_at: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    created_at: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("reservations_user_id_idx").on(table.user_id),
    index("reservations_station_id_idx").on(table.station_id),
    index("reservations_time_slot_id_idx").on(table.time_slot_id),
    index("reservations_status_idx").on(table.status),
    index("reservations_created_at_idx").on(table.created_at),
    index("reservations_stripe_payment_succeeded_at_idx").on(table.stripe_payment_succeeded_at),
    index("reservations_entry_type_station_idx").on(table.entry_type, table.station_id),
    index("reservations_booking_source_idx").on(table.booking_source),
    /** Used by computeAvailability to look up post occupancy for a given day. */
    index("reservations_post_id_idx").on(table.post_id),
  ]
);

/**
 * No-show fee record after queue switch (pending | paid | waived).
 */
export const noShowFees = pgTable("no_show_fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservation_id: uuid("reservation_id")
    .notNull()
    .references(() => reservations.id, { onDelete: "cascade" }),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  station_id: uuid("station_id")
    .notNull()
    .references(() => stations.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 30 }).notNull(),
  stripe_payment_id: varchar("stripe_payment_id", { length: 200 }),
  stripe_transfer_id: varchar("stripe_transfer_id", { length: 200 }),
  created_at: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});
