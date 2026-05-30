-- Snapshot the station_services row picked at booking. Legacy entries
-- created before this column shipped stay NULL and fall back to the vehicle
-- format label client-side. ON DELETE SET NULL: removing a service must not
-- cascade-delete past entries.
--
-- Idempotent: every step uses IF NOT EXISTS / DO blocks so re-running
-- `db:migrate` (or applying the file manually via Neon SQL editor) does
-- not break on already-applied constraints or indexes.

ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "service_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_service_id_station_services_id_fk'
  ) THEN
    ALTER TABLE "reservations"
      ADD CONSTRAINT "reservations_service_id_station_services_id_fk"
      FOREIGN KEY ("service_id") REFERENCES "station_services"("id") ON DELETE SET NULL
      NOT VALID;
    ALTER TABLE "reservations"
      VALIDATE CONSTRAINT "reservations_service_id_station_services_id_fk";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "reservations_service_id_idx"
  ON "reservations" ("service_id")
  WHERE "service_id" IS NOT NULL;
