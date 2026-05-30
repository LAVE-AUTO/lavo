-- Add composite primary key to station_hours.
-- The unique index on (station_id, day_of_week) served as the only uniqueness
-- constraint but provided no PK, which breaks Drizzle's relational query builder
-- and leaves the table without a proper identity. The PK replaces the index.
--> statement-breakpoint
DROP INDEX IF EXISTS "station_hours_station_day_unique";
--> statement-breakpoint
ALTER TABLE "station_hours"
  ADD CONSTRAINT "station_hours_pkey" PRIMARY KEY ("station_id", "day_of_week");
