/**
 * Key-value settings scoped by type and optional entity_id.
 *
 * Type values: admin (platform-wide) | station (per-station) | user (per-user).
 * Uniqueness: one value per (type, entity_id, key) tuple.
 * Scope: entity_id = null means global (admin) scope; non-null means scoped to that entity.
 * Audit: updated_by tracks which admin last modified the setting.
 *
 * Partial unique indexes enforce these constraints:
 *   - settings_type_key_global_idx: (type, key) for global rows (entity_id IS NULL)
 *   - settings_type_entity_key_idx: (type, entity_id, key) for scoped rows (entity_id IS NOT NULL)
 */
import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";


// %%%%% Enums %%%%%
// Settings type enumeration

export const settingsTypeEnum = pgEnum("settings_type", [
  "admin",
  "station",
  "user",
  "legal",
]);


// %%%%% Table definition %%%%%
// Key-value store with scope and audit tracking

export const settings = pgTable(
  "settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: settingsTypeEnum("type").notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    value: text("value"),
    entity_id: uuid("entity_id"),
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
    updated_by: uuid("updated_by"),
  },
  (table) => [
    // Global settings: enforces one value per (type, key) when entity_id is null
    uniqueIndex("settings_type_key_global_idx")
      .on(table.type, table.key)
      .where(sql`${table.entity_id} is null`),

    // Scoped settings: enforces one value per (type, entity_id, key) when entity_id is not null
    uniqueIndex("settings_type_entity_key_idx")
      .on(table.type, table.entity_id, table.key)
      .where(sql`${table.entity_id} is not null`),
  ]
);
