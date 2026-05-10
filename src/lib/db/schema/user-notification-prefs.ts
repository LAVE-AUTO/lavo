import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userNotificationPrefs = pgTable("user_notification_prefs", {
  user_id: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  prefs: jsonb("prefs").notNull().default({}),
  created_at: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});
