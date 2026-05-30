-- Make vehicle_format_id nullable in reservations to support non-hand_wash services
-- (automatic, self_service) that have no vehicle format concept.
-- Existing rows keep their vehicle_format_id values unchanged.

ALTER TABLE "reservations" ALTER COLUMN "vehicle_format_id" DROP NOT NULL;
