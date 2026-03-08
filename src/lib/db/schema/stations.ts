/**
 * Stations, station config (1-1), vehicle formats, and station documents.
 * Station identity, approval lifecycle, and per-station pricing by vehicle format.
 */
import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const washTypeEnum = pgEnum("wash_type", [
  "hand_wash",
  "automatic",
  "self_service",
]);

/**
 * Station identity, approval lifecycle, and operational flags.
 * user_id links to the managing user account (role = station).
 */
export const stations = pgTable(
  "stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Managing user account for this station (role = station)
    user_id: uuid("user_id").references(() => users.id),
    name: varchar("name", { length: 200 }).notNull(),
    legal_name: varchar("legal_name", { length: 200 }),
    registration_number: varchar("registration_number", { length: 100 }),
    address: text("address").notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    wash_type: washTypeEnum("wash_type"),
    description: text("description"),
    wash_post_count: integer("wash_post_count"),
    status: varchar("status", { length: 30 }).notNull(),
    is_open: boolean("is_open").notNull().default(false),
    stripe_account_id: varchar("stripe_account_id", { length: 100 }),
    average_score: decimal("average_score", { precision: 3, scale: 2 }),
    total_ratings: integer("total_ratings").notNull().default(0),
    approved_by: uuid("approved_by").references(() => users.id),
    approved_at: timestamp("approved_at", {
      mode: "date",
      withTimezone: true,
    }),
    rejection_reason: text("rejection_reason"),
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
    index("stations_status_idx").on(table.status),
    index("stations_city_idx").on(table.city),
    index("stations_is_open_idx").on(table.is_open),
    index("stations_user_id_idx").on(table.user_id),
  ]
);

/**
 * One-to-one operational config per station. id = station id.
 * break_start/break_end define a pause window; cancellation_delay_minutes is used for cancellation policy.
 * max_concurrent_posts: max posts in service at once (defaults to wash_post_count at creation).
 * margin_before_minutes / margin_after_minutes: prep and cleanup margins (Figma-aligned).
 */
export const stationConfigs = pgTable("station_configs", {
  id: uuid("id")
    .primaryKey()
    .references(() => stations.id, { onDelete: "cascade" }),
  opening_time: time("opening_time", { withTimezone: true }).notNull(),
  closing_time: time("closing_time", { withTimezone: true }).notNull(),
  break_start: time("break_start", { withTimezone: true }),
  break_end: time("break_end", { withTimezone: true }),
  wash_duration_minutes: integer("wash_duration_minutes").notNull(),
  wash_post_count: integer("wash_post_count").notNull(),
  late_tolerance_minutes: integer("late_tolerance_minutes").notNull(),
  cancellation_delay_minutes: integer("cancellation_delay_minutes").notNull(),
  max_concurrent_posts: integer("max_concurrent_posts").notNull().default(1),
  margin_before_minutes: integer("margin_before_minutes").notNull().default(5),
  margin_after_minutes: integer("margin_after_minutes").notNull().default(10),
  /** Reservation surcharge (format price + this = reservation total). Queue = format only. */
  reservation_surcharge: decimal("reservation_surcharge", {
    precision: 10,
    scale: 2,
  }),
  updated_at: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

/**
 * Per-station posts (wash bays) with 1-based position and active flag.
 * Unique (station_id, position). Used for capacity and Figma-aligned post state.
 */
export const stationPosts = pgTable(
  "station_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    is_active: boolean("is_active").notNull().default(true),
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
    uniqueIndex("station_posts_station_id_position_unique").on(table.station_id, table.position),
  ]
);

/**
 * Per-station vehicle format and price (e.g. Petit, Moyen, SUV).
 */
export const vehicleFormats = pgTable("vehicle_formats", {
  id: uuid("id").primaryKey().defaultRandom(),
  station_id: uuid("station_id")
    .notNull()
    .references(() => stations.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 100 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  is_active: boolean("is_active").notNull(),
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
});

/**
 * Documents submitted during station onboarding (step 3).
 * One row per document; terms_accepted records the legal confirmation checkbox.
 * storage: 'cloudinary' (default) or 'local'; local files are synced to Cloudinary by cron.
 */
export const stationDocuments = pgTable("station_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  station_id: uuid("station_id")
    .notNull()
    .references(() => stations.id, { onDelete: "cascade" }),
  document_type: varchar("document_type", { length: 50 }).notNull(),
  file_url: text("file_url").notNull(),
  storage: varchar("storage", { length: 20 }).notNull().default("cloudinary"),
  terms_accepted: boolean("terms_accepted").notNull().default(false),
  created_at: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

/**
 * Rows to process by sync-pending-uploads job: local files to upload to Cloudinary.
 * Job reads batch by created_at, uploads file from station_documents.file_url, then clears row.
 */
export const pendingUploads = pgTable(
  "pending_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    station_document_id: uuid("station_document_id")
      .notNull()
      .references(() => stationDocuments.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("pending_uploads_created_at_idx").on(table.created_at)]
);
