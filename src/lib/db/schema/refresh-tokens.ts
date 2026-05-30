import { boolean, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token_hash: varchar("token_hash", { length: 64 }).notNull().unique(),
    /**
     * Persisted at issue time so token rotation can re-emit a long-lived session without
     * having to infer rememberMe from TTL (bug #11). Defaults to false for legacy rows.
     */
    remember_me: boolean("remember_me").notNull().default(false),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    revoked_at: timestamp("revoked_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("refresh_tokens_user_id_idx").on(table.user_id)],
);
