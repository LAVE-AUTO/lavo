-- Add vehicle_label to service_vehicle_entries so all categories (hand_wash,
-- automatic, self_service) can carry a human-readable name alongside their
-- pricing. For hand_wash this mirrors the vehicle format label; for automatic
-- it is the package name (e.g. "Forfait Premium"); for self_service it is a
-- fixed label.
--
-- Also relax vehicle_format_id: drop the FK and NOT NULL so that automatic
-- and self_service entries can exist without a matching vehicle_formats row.
-- The column keeps its uuid type; NULL means "not linked to a vehicle format".
-- The unique index is kept — PostgreSQL treats NULLs as distinct, so multiple
-- package rows per service are allowed.

ALTER TABLE "service_vehicle_entries"
  ADD COLUMN IF NOT EXISTS "vehicle_label" varchar(255) NOT NULL DEFAULT '';

ALTER TABLE "service_vehicle_entries"
  DROP CONSTRAINT IF EXISTS "service_vehicle_entries_vehicle_format_id_vehicle_formats_id_fk";

ALTER TABLE "service_vehicle_entries"
  ALTER COLUMN "vehicle_format_id" DROP NOT NULL;
