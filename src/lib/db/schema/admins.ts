/**
 * Super Admin accounts and audit log.
 * Admins authenticate separately from clients; actions are logged in admin_logs.
 */
import { jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Super Admin accounts; authenticate separately from clients. */
export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password_hash: text("password_hash").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
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
});

/**
 * Audit log for admin actions (station approval, commission update, etc.).
 */
export const adminLogs = pgTable("admin_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  admin_id: uuid("admin_id")
    .notNull()
    .references(() => admins.id, { onDelete: "cascade" }),
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
