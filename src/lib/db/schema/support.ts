/**
 * Support tickets created by users, optionally assigned to admins.
 */
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const supportPriorityEnum = pgEnum("support_priority", [
  "bas",
  "normal",
  "urgent",
]);

export const supportCategoryEnum = pgEnum("support_category", [
  "technique",
  "facturation",
  "bug",
  "autre",
]);

/**
 * DB-level enum for ticket status.
 * Requires a migration: ALTER TYPE or CREATE TYPE + ALTER COLUMN.
 * The migration (0018) used varchar — a follow-up migration must add this enum
 * and convert the column before this schema change is deployed to production.
 */
export const supportStatusEnum = pgEnum("support_status", [
  "ouvert",
  "en_cours",
  "resolu",
  "ferme",
]);

/** Support tickets created by users; optionally assigned to admins. */
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticket_number: varchar("ticket_number", { length: 20 }).notNull().unique(),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assigned_to: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    subject: varchar("subject", { length: 255 }).notNull(),
    status: supportStatusEnum("status").notNull().default("ouvert"),
    priority: supportPriorityEnum("priority").notNull().default("normal"),
    category: supportCategoryEnum("category").notNull().default("autre"),
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
  },
  (table) => [
    index("support_tickets_created_by_idx").on(table.created_by),
    index("support_tickets_status_idx").on(table.status),
    index("support_tickets_created_at_idx").on(table.created_at),
    index("support_tickets_updated_at_idx").on(table.updated_at),
  ],
);

/** Conversation messages within a support ticket. */
export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticket_id: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    sender_id: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    is_from_admin: boolean("is_from_admin").notNull().default(false),
    content: text("content").notNull(),
    created_at: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("support_messages_ticket_id_created_at_idx").on(
      table.ticket_id,
      table.created_at,
    ),
  ],
);

/** Global support settings configurable by Super Admin. */
export const supportSettings = pgTable("support_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updated_at: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});
