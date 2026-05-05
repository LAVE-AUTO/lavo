/**
 * In-app notification feed for clients.
 * Distinct from the existing `notifications` table which is a push/email audit log.
 * Cursor-based pagination via (created_at DESC, id DESC).
 */
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Logical kind: queue_new | delay_request | payout_received | system */
    kind: varchar("kind", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    action_url: varchar("action_url", { length: 500 }),
    payload: jsonb("payload"),
    read_at: timestamp("read_at", { mode: "date", withTimezone: true }),
    created_at: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_notifications_user_read_created_idx").on(
      table.user_id,
      table.read_at,
      table.created_at
    ),
  ]
);
