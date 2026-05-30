-- Add soft delete support to station_services.
-- DELETE /station/services/:id sets deleted_at instead of removing the row.
-- All reads filter WHERE deleted_at IS NULL.

ALTER TABLE "station_services"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
