/**
 * User and email verification token tables.
 * Client accounts, identity, and verification tokens (email, password reset).
 */
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "client", "station"]);

/**
 * All user accounts regardless of role.
 * first_name / last_name are nullable to support station accounts.
 * A CHECK constraint in the DB ensures client accounts always have both names.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: station accounts do not provide personal names
    first_name: varchar("first_name", { length: 100 }),
    last_name: varchar("last_name", { length: 100 }),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 30 }),
    password_hash: text("password_hash"),
    role: userRoleEnum("role").notNull().default("client"),
    status: varchar("status", { length: 30 }).notNull(),
    // When true the user must change their password before accessing any endpoint
    force_password_change: boolean("force_password_change")
      .notNull()
      .default(false),
    email_verified_at: timestamp("email_verified_at", {
      mode: "date",
      withTimezone: true,
    }),
    // Successful logins granted while the email is still unverified. Clients
    // get a limited grace (5 logins) before verification becomes mandatory.
    unverified_login_count: integer("unverified_login_count")
      .notNull()
      .default(0),
    stripe_customer_id: varchar("stripe_customer_id", { length: 100 }),
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
  (table) => [
    index("users_status_idx").on(table.status),
    index("users_role_idx").on(table.role),
  ],
);

/**
 * Tokens for email verification and password reset.
 * One token per row; used_at set when consumed.
 */
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    type: varchar("type", { length: 30 }).notNull(),
    expires_at: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    used_at: timestamp("used_at", {
      mode: "date",
      withTimezone: true,
    }),
    created_at: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("email_verification_tokens_token_idx").on(table.token)],
);
