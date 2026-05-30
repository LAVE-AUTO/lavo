/**
 * Stations, station config (1-1), vehicle formats, and station documents.
 * Station identity, approval lifecycle, and per-station pricing by vehicle format.
 */
import {
  bigint,
  boolean,
  date,
  decimal,
  index,
  integer,
  jsonb,
  numeric,
  pgMaterializedView,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// %%%%% Wash types %%%%%

/**
 * Reference table for wash types (e.g. hand_wash, automatic, self_service).
 * Seeded by migration; admin CRUD out of scope for Unit 4.
 */
export const washTypes = pgTable("wash_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
});

/**
 * Junction: stations can have multiple wash types.
 * station_id references stations (cascade delete); wash_type_id references wash_types.
 */
export const stationWashTypes = pgTable(
  "station_wash_types",
  {
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    wash_type_id: uuid("wash_type_id")
      .notNull()
      .references(() => washTypes.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("station_wash_types_station_id_wash_type_id_unique").on(
      table.station_id,
      table.wash_type_id,
    ),
  ],
);

// %%%%% END - Wash types %%%%%

// %%%%% Stations %%%%%

/**
 * Station identity, approval lifecycle, and operational flags.
 * user_id links to the managing user account (role = station).
 * Wash types are stored in station_wash_types (many-to-many).
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
    postal_code: varchar("postal_code", { length: 20 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    description: text("description"),
    /** Type de prestation: exterior only, interior only, or both. Nullable for existing stations. */
    service_scope: varchar("service_scope", { length: 20 }),
    wash_post_count: integer("wash_post_count"),
    /** Promo QR configuration stored by the admin promo section. */
    promo_commission_rate: decimal("promo_commission_rate", { precision: 5, scale: 4 }),
    promo_ref_code: varchar("promo_ref_code", { length: 128 }),
    promo_ref_generated_at: timestamp("promo_ref_generated_at", {
      mode: "date",
      withTimezone: true,
    }),
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
    rejection_count: integer("rejection_count").notNull().default(0),
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
    notification_prefs: jsonb("notification_prefs"),
  },
  (table) => [
    index("stations_status_idx").on(table.status),
    index("stations_city_idx").on(table.city),
    index("stations_is_open_idx").on(table.is_open),
    index("stations_user_id_idx").on(table.user_id),
    index("stations_service_scope_idx").on(table.service_scope),
    index("stations_approved_at_idx").on(table.approved_at),
    index("stations_updated_at_idx").on(table.updated_at),
    index("stations_promo_ref_code_idx").on(table.promo_ref_code),
  ],
);

// %%%%% END - Stations %%%%%

// %%%%% Station config & posts %%%%%

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
    uniqueIndex("station_posts_station_id_position_unique").on(
      table.station_id,
      table.position,
    ),
  ],
);

// %%%%% END - Station config & posts %%%%%

// %%%%% Vehicle formats %%%%%

/**
 * Global vehicle formats shared by all stations (e.g. Berline, SUV, Utilitaire).
 * Not station-scoped — managed by admin.
 */
export const vehicleFormats = pgTable(
  "vehicle_formats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
  },
  () => [],
);

// %%%%% END - Vehicle formats %%%%%

// %%%%% Station documents %%%%%

/**
 * Documents submitted during station onboarding (step 3).
 * One row per document; terms_accepted records the legal confirmation checkbox.
 * storage: 'cloudinary' (default) or 'local'; local files are synced to Cloudinary by cron.
 */
export const stationDocuments = pgTable(
  "station_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    document_type: varchar("document_type", { length: 50 }).notNull(),
    file_url: text("file_url").notNull(),
    storage: varchar("storage", { length: 20 }).notNull().default("cloudinary"),
    terms_accepted: boolean("terms_accepted").notNull().default(false),
    /** Date when the document expires. Set during station approval. Null = no expiry tracked. */
    expiry_date: date("expiry_date", { mode: "date" }),
    /** Timestamp when the first expiry reminder was sent (anti-duplicate flag). */
    reminder_first_sent_at: timestamp("reminder_first_sent_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** Timestamp when the second expiry reminder was sent (anti-duplicate flag). */
    reminder_second_sent_at: timestamp("reminder_second_sent_at", {
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
  (table) => [
    index("station_documents_expiry_date_idx").on(table.expiry_date),
    index("station_documents_station_id_idx").on(table.station_id),
  ],
);

// %%%%% END - Station documents %%%%%

// %%%%% Pending uploads %%%%%

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
  (table) => [index("pending_uploads_created_at_idx").on(table.created_at)],
);

// %%%%% END - Pending uploads %%%%%

// %%%%% Station photos %%%%%

/**
 * Dedicated table for station photo URLs.
 * Replaces the previous approach of storing photos in station_documents
 * with document_type = 'photo'. position is 0-based; ordered ascending.
 */
export const stationPhotos = pgTable(
  "station_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    created_at: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("station_photos_station_id_idx").on(table.station_id)],
);

// %%%%% END - Station photos %%%%%

// %%%%% Materialized views %%%%%

/**
 * Precomputed station statistics: available_slots, completed_count, average_rating, total_ratings.
 * Populated by migration 0035. Refreshed concurrently after reservation completions and rating changes.
 * Use .existing() because Drizzle does not manage this view; the SQL migration owns it.
 */
export const stationStats = pgMaterializedView("station_stats", {
  station_id: uuid("station_id").notNull(),
  available_slots: bigint("available_slots", { mode: "number" }).notNull(),
  completed_count: bigint("completed_count", { mode: "number" }).notNull(),
  average_rating: numeric("average_rating").notNull(),
  total_ratings: bigint("total_ratings", { mode: "number" }).notNull(),
}).existing();

// %%%%% END - Materialized views %%%%%
