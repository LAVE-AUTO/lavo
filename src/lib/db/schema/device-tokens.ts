/**
 * Device tokens table.
 * Stores FCM push notification tokens for user devices.
 * One user may have multiple tokens (multiple devices/platforms).
 * Tokens are unique across all users — a device re-registering on a new account
 * will cause a conflict which the upsert in the route handler resolves.
 */
import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 500 }).notNull().unique(),
    platform: varchar("platform", { length: 20 }).notNull(),
    created_at: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // user_id_created_at_idx has user_id as its leftmost prefix, so it also serves
    // user_id-only lookups (e.g. DELETE cascade, listing tokens per user). The former
    // single-column user_id_idx is therefore redundant and removed.
    index("device_tokens_user_id_created_at_idx").on(
      table.user_id,
      table.created_at,
    ),
  ],
);
