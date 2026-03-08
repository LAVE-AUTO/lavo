-- Migration 0008: wash types and station_wash_types (Unit 4).
-- Creates wash_types table, seeds it, creates station_wash_types junction,
-- backfills from stations.wash_type, then drops stations.wash_type and enum.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wash_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(50) NOT NULL UNIQUE,
  "label" varchar(100) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true
);

--> statement-breakpoint
INSERT INTO "wash_types" ("code", "label", "sort_order", "is_active")
VALUES
  ('hand_wash', 'Lavage à la main', 1, true),
  ('automatic', 'Lavage automatique', 2, true),
  ('self_service', 'Libre-service', 3, true);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "station_wash_types" (
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "wash_type_id" uuid NOT NULL REFERENCES "wash_types"("id") ON DELETE CASCADE,
  PRIMARY KEY ("station_id", "wash_type_id")
);

--> statement-breakpoint
INSERT INTO "station_wash_types" ("station_id", "wash_type_id")
SELECT s.id, wt.id
FROM "stations" s
JOIN "wash_types" wt ON wt.code = s.wash_type::text
WHERE s.wash_type IS NOT NULL;

--> statement-breakpoint
ALTER TABLE "stations" DROP COLUMN IF EXISTS "wash_type";

--> statement-breakpoint
DROP TYPE IF EXISTS "wash_type";
