-- Completes the vehicle_formats "global catalog" refactor. The Drizzle schema
-- has no station_id (formats are admin-managed and shared across stations, with
-- a case-insensitive unique label index from 0049), but the legacy per-station
-- station_id column was never dropped — its NOT NULL constraint made every
-- insert fail. Drop the FK, its index, and the column.

ALTER TABLE "vehicle_formats" DROP CONSTRAINT IF EXISTS "vehicle_formats_station_id_stations_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "vehicle_formats_station_id_idx";
--> statement-breakpoint
ALTER TABLE "vehicle_formats" DROP COLUMN IF EXISTS "station_id";
