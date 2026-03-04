/**
 * Commission rate history set by admins.
 * Effective at a given time; past reservations keep their snapshot rate.
 */
import { decimal, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Commission rate history; effective_at defines when rate applies. */
export const commissionSettings = pgTable("commission_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  rate: decimal("rate", { precision: 5, scale: 4 }).notNull(),
  set_by: uuid("set_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  effective_at: timestamp("effective_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  created_at: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});
