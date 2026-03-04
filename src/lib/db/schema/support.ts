/**
 * Support tickets created by users, optionally assigned to admins.
 */
import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Support tickets created by users; optionally assigned to admins. */
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  created_by: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  assigned_to: uuid("assigned_to").references(() => users.id, {
    onDelete: "set null",
  }),
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 30 }).notNull(),
  resolved_at: timestamp("resolved_at", {
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
});
