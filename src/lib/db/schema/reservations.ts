/**
 * Reservations and no-show fees.
 * Booking lifecycle, queue, and financial snapshot; no-show fee records after queue switch.
 */
import {
  decimal,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stations, vehicleFormats } from "./stations";
import { timeSlots } from "./slots";
import { users } from "./users";

/** Reservation lifecycle, queue position, and payment snapshot. */
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    time_slot_id: uuid("time_slot_id")
      .notNull()
      .references(() => timeSlots.id, { onDelete: "cascade" }),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    vehicle_format_id: uuid("vehicle_format_id")
      .notNull()
      .references(() => vehicleFormats.id),
    status: varchar("status", { length: 30 }).notNull(),
    queue_position: integer("queue_position"),
    amount_paid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
    commission_rate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull(),
    commission_amount: decimal("commission_amount", { precision: 10, scale: 2 }),
    station_payout: decimal("station_payout", { precision: 10, scale: 2 }),
    tip_amount: decimal("tip_amount", { precision: 10, scale: 2 }),
    stripe_payment_id: varchar("stripe_payment_id", { length: 200 }),
    stripe_transfer_id: varchar("stripe_transfer_id", { length: 200 }),
    cancellation_reason: text("cancellation_reason"),
    penalty_amount: decimal("penalty_amount", { precision: 10, scale: 2 }),
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
