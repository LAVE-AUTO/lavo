/**
 * User and email verification token tables.
 * Client accounts, identity, and verification tokens (email, password reset).
 */
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "client",
  "station",
]);

/** Client accounts and identity. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    first_name: varchar("first_name", { length: 100 }).notNull(),
    last_name: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 30 }),
    password_hash: text("password_hash"),
    role: userRoleEnum("role").notNull().default("client"),
    status: varchar("status", { length: 30 }).notNull(),
    email_verified_at: timestamp("email_verified_at", {
      mode: "date",
      withTimezone: true,
    }),
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
  ]
);

/**
 * Tokens for email verification and password reset.
 * One token per row; used_at set when consumed.
 */
export const emailVerificationTokens = pgTable("email_verification_tokens", {
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
});

