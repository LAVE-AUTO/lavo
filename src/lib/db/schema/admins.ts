/**
 * Admin audit log.
 * References rows in users table with role = 'admin'.
 */
import { jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const adminLogs = pgTable("admin_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  admin_id: uuid("admin_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(),
  target_type: varchar("target_type", { length: 50 }),
  target_id: uuid("target_id"),
  details: jsonb("details"),
  created_at: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});
