/**
 * Key-value settings scoped by type and optional entity_id.
 * type: admin | station | user; one value per (type, entity_id, key).
 * Partial unique indexes enforce uniqueness when entity_id is null (global) and when non-null.
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

export const settingsTypeEnum = pgEnum("settings_type", [
  "admin",
  "station",
  "user",
]);

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
  },
  (table) => [
    uniqueIndex("settings_type_key_global_idx")
      .on(table.type, table.key)
      .where(sql`${table.entity_id} is null`),
    uniqueIndex("settings_type_entity_key_idx")
      .on(table.type, table.entity_id, table.key)
      .where(sql`${table.entity_id} is not null`),
  ]
);
