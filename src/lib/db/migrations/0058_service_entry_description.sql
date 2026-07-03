-- Adds an optional per-entry description to service_vehicle_entries so
-- automatic-service forfaits can describe what each package includes.

ALTER TABLE "service_vehicle_entries" ADD COLUMN IF NOT EXISTS "description" text;
