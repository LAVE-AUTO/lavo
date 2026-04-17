/**
 * Audit of push/email notifications sent by event.
 * Optional FKs: user_id, station_id, reservation_id depending on recipient/context.
 */
import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { reservations } from "./reservations";
import { stations } from "./stations";
import { users } from "./users";

/** Audit of push/email notifications sent by event; optional FKs for recipient/context. */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  station_id: uuid("station_id").references(() => stations.id, {
    onDelete: "set null",
  }),
  reservation_id: uuid("reservation_id").references(() => reservations.id, {
    onDelete: "set null",
  }),
  type: varchar("type", { length: 50 }).notNull(),
  event: varchar("event", { length: 100 }).notNull(),
  status: varchar("status", { length: 30 }).notNull(),
  sent_at: timestamp("sent_at", {
    mode: "date",
    withTimezone: true,
  }),
  created_at: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});
