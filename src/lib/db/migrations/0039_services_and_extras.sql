-- Services: named packages (Essentiel, Premium, VIP) per station
CREATE TABLE IF NOT EXISTS "station_services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "category" varchar(50) NOT NULL,
  "service_type" varchar(50) NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_popular" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Service pricing per vehicle format
CREATE TABLE IF NOT EXISTS "service_vehicle_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_id" uuid NOT NULL REFERENCES "station_services"("id") ON DELETE CASCADE,
  "vehicle_format_id" uuid NOT NULL REFERENCES "vehicle_formats"("id") ON DELETE CASCADE,
  "price" decimal(10, 2) NOT NULL,
  "duration_min" integer NOT NULL DEFAULT 45,
  "staff_required" integer NOT NULL DEFAULT 1,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Extras/add-ons available at a station
CREATE TABLE IF NOT EXISTS "station_extras" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "label" varchar(255) NOT NULL,
  "scope" varchar(50) NOT NULL,
  "price" decimal(10, 2) NOT NULL,
  "duration_min" integer NOT NULL DEFAULT 10,
  "staff_required" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Extra pricing per vehicle format (optional, defaults to main price if not set)
CREATE TABLE IF NOT EXISTS "extra_vehicle_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "extra_id" uuid NOT NULL REFERENCES "station_extras"("id") ON DELETE CASCADE,
  "vehicle_format_id" uuid NOT NULL REFERENCES "vehicle_formats"("id") ON DELETE CASCADE,
  "price" decimal(10, 2) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Compatibility: which extras can be added to which services
CREATE TABLE IF NOT EXISTS "service_extra_compatibility" (
  "service_id" uuid NOT NULL REFERENCES "station_services"("id") ON DELETE CASCADE,
  "extra_id" uuid NOT NULL REFERENCES "station_extras"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "station_services_station_id_idx" ON "station_services" ("station_id");
CREATE INDEX IF NOT EXISTS "service_vehicle_entries_service_id_idx" ON "service_vehicle_entries" ("service_id");
CREATE INDEX IF NOT EXISTS "service_vehicle_entries_vehicle_format_id_idx" ON "service_vehicle_entries" ("vehicle_format_id");
CREATE INDEX IF NOT EXISTS "station_extras_station_id_idx" ON "station_extras" ("station_id");
CREATE INDEX IF NOT EXISTS "extra_vehicle_entries_extra_id_idx" ON "extra_vehicle_entries" ("extra_id");
CREATE INDEX IF NOT EXISTS "service_extra_compatibility_service_id_idx" ON "service_extra_compatibility" ("service_id");
CREATE INDEX IF NOT EXISTS "service_extra_compatibility_extra_id_idx" ON "service_extra_compatibility" ("extra_id");

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "service_vehicle_entries_service_format_unique" ON "service_vehicle_entries" ("service_id", "vehicle_format_id");
CREATE UNIQUE INDEX IF NOT EXISTS "extra_vehicle_entries_extra_format_unique" ON "extra_vehicle_entries" ("extra_id", "vehicle_format_id");
CREATE UNIQUE INDEX IF NOT EXISTS "service_extra_compatibility_unique" ON "service_extra_compatibility" ("service_id", "extra_id");
