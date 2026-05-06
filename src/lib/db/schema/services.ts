/**
 * Station services, extras, and their pricing configurations.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { stations } from "./stations";
import { vehicleFormats } from "./stations";

// ===== SERVICES (Packages) =====

export const stationServices = pgTable(
  "station_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(), // hand_wash, automatic, self_service
    service_type: varchar("service_type", { length: 50 }).notNull(), // exterior, interior, complete
    description: text("description"),
    is_active: boolean("is_active").notNull().default(true),
    is_popular: boolean("is_popular").notNull().default(false),
    created_at: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("station_services_station_id_idx").on(table.station_id),
  ]
);

// ===== SERVICE PRICING PER VEHICLE FORMAT =====

export const serviceVehicleEntries = pgTable(
  "service_vehicle_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    service_id: uuid("service_id")
      .notNull()
      .references(() => stationServices.id, { onDelete: "cascade" }),
    vehicle_format_id: uuid("vehicle_format_id")
      .notNull()
      .references(() => vehicleFormats.id, { onDelete: "cascade" }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    duration_min: integer("duration_min").notNull().default(45),
    staff_required: integer("staff_required").notNull().default(1),
    is_active: boolean("is_active").notNull().default(true),
    created_at: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("service_vehicle_entries_service_id_idx").on(table.service_id),
    index("service_vehicle_entries_vehicle_format_id_idx").on(
      table.vehicle_format_id
    ),
    uniqueIndex("service_vehicle_entries_service_format_unique").on(
      table.service_id,
      table.vehicle_format_id
    ),
  ]
);

// ===== EXTRAS (Add-ons) =====

export const stationExtras = pgTable(
  "station_extras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 255 }).notNull(),
    scope: varchar("scope", { length: 50 }).notNull(), // exterior, interior, both
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    duration_min: integer("duration_min").notNull().default(10),
    staff_required: integer("staff_required").notNull().default(0),
    is_active: boolean("is_active").notNull().default(true),
    created_at: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("station_extras_station_id_idx").on(table.station_id),
  ]
);

// ===== EXTRA PRICING PER VEHICLE FORMAT =====

export const extraVehicleEntries = pgTable(
  "extra_vehicle_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    extra_id: uuid("extra_id")
      .notNull()
      .references(() => stationExtras.id, { onDelete: "cascade" }),
    vehicle_format_id: uuid("vehicle_format_id")
      .notNull()
      .references(() => vehicleFormats.id, { onDelete: "cascade" }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    is_active: boolean("is_active").notNull().default(true),
    created_at: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("extra_vehicle_entries_extra_id_idx").on(table.extra_id),
    uniqueIndex("extra_vehicle_entries_extra_format_unique").on(
      table.extra_id,
      table.vehicle_format_id
    ),
  ]
);

// ===== COMPATIBILITY: Which extras work with which services =====

export const serviceExtraCompatibility = pgTable(
  "service_extra_compatibility",
  {
    service_id: uuid("service_id")
      .notNull()
      .references(() => stationServices.id, { onDelete: "cascade" }),
    extra_id: uuid("extra_id")
      .notNull()
      .references(() => stationExtras.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("service_extra_compatibility_service_id_idx").on(table.service_id),
    index("service_extra_compatibility_extra_id_idx").on(table.extra_id),
    uniqueIndex("service_extra_compatibility_unique").on(
      table.service_id,
      table.extra_id
    ),
  ]
);

// ===== TYPES =====

export type StationService = typeof stationServices.$inferSelect;
export type ServiceVehicleEntry = typeof serviceVehicleEntries.$inferSelect;
export type StationExtra = typeof stationExtras.$inferSelect;
export type ExtraVehicleEntry = typeof extraVehicleEntries.$inferSelect;
export type ServiceExtraCompatibility = typeof serviceExtraCompatibility.$inferSelect;
