/**
 * Disputes table.
 * A client can open a dispute against a completed/paid reservation.
 * Admins can refund or close (resolve/reject) disputes.
 * One dispute per reservation (unique on reservation_id).
 */
import {
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { reservations } from "./reservations";
import { stations } from "./stations";
import { users } from "./users";

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "refunded",
  "resolved",
  "rejected",
]);

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservation_id: uuid("reservation_id")
      .notNull()
      .unique()
      .references(() => reservations.id, { onDelete: "cascade" }),
    client_id: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    description: text("description"),
    status: disputeStatusEnum("status").notNull().default("open"),
    requested_amount: decimal("requested_amount", { precision: 10, scale: 2 }),
    refunded_amount: decimal("refunded_amount", { precision: 10, scale: 2 }),
    stripe_refund_id: varchar("stripe_refund_id", { length: 200 }),
    closed_by: uuid("closed_by").references(() => users.id),
    closed_reason: text("closed_reason"),
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
    index("disputes_reservation_id_idx").on(table.reservation_id),
    index("disputes_client_id_idx").on(table.client_id),
    index("disputes_station_id_idx").on(table.station_id),
    index("disputes_status_idx").on(table.status),
    index("disputes_created_at_idx").on(table.created_at),
  ]
);
