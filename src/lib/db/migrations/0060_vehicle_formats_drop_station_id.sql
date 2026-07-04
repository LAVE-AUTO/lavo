-- Completes the vehicle_formats "global catalog" refactor. The Drizzle schema
-- has no station_id (formats are admin-managed and shared across stations, with
-- a case-insensitive unique label index from 0049), but the legacy per-station
-- station_id column was created NOT NULL by 0000 and never relaxed — so every
-- insert (which omits station_id) failed the NOT NULL constraint.
--
-- We DROP the NOT NULL rather than dropping the column: keeping the column means
-- 0000's `ADD CONSTRAINT ... FOREIGN KEY (station_id)` still resolves on a
-- re-run of db:migrate-all (idempotent), while a NULL value is harmless because
-- the ORM no longer reads or writes station_id. Guarded so it is a no-op on
-- databases where the column is already gone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_formats' AND column_name = 'station_id'
  ) THEN
    ALTER TABLE "vehicle_formats" ALTER COLUMN "station_id" DROP NOT NULL;
  END IF;
END $$;
