/**
 * Rate limit tracking table for auth endpoints.
 * Keyed by IP address; tracks failed attempts and block window.
 */
import {
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 255 }).notNull().unique(),
    attempts: integer("attempts").notNull().default(0),
    blocked_until: timestamp("blocked_until", {
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
  (table) => [index("auth_rate_limits_key_idx").on(table.key)]
);
