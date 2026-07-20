-- Migration 0064: relational service categories & types.
-- Reuses wash_types (hand_wash/automatic/self_service, seeded in 0008) as the
-- canonical service-category table. Adds service_types (types that belong to
-- a category — only hand_wash has any today), then additive FK columns on
-- station_services (category_id, type_id) and station_extras (category_id),
-- backfilled from the existing varchar columns. Old varchar columns
-- (category, service_type, scope) are kept — additive migration, no drops.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wash_type_id" uuid NOT NULL REFERENCES "wash_types"("id") ON DELETE CASCADE,
  "code" varchar(50) NOT NULL,
  "label" varchar(100) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  CONSTRAINT "service_types_wash_type_id_code_unique" UNIQUE ("wash_type_id", "code")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_types_wash_type_id_idx" ON "service_types" ("wash_type_id");

--> statement-breakpoint
INSERT INTO "service_types" ("wash_type_id", "code", "label", "sort_order", "is_active")
SELECT wt.id, v.code, v.label, v.sort_order, true
FROM "wash_types" wt
CROSS JOIN (VALUES
  ('exterior', 'Extérieur', 1),
  ('interior', 'Intérieur', 2),
  ('complete', 'Complet', 3),
  ('detailing', 'Esthétique automobile', 4)
) AS v(code, label, sort_order)
WHERE wt.code = 'hand_wash'
ON CONFLICT ("wash_type_id", "code") DO NOTHING;

--> statement-breakpoint
ALTER TABLE "station_services" ADD COLUMN IF NOT EXISTS "category_id" uuid REFERENCES "wash_types"("id");

--> statement-breakpoint
ALTER TABLE "station_services" ADD COLUMN IF NOT EXISTS "type_id" uuid REFERENCES "service_types"("id");

--> statement-breakpoint
ALTER TABLE "station_extras" ADD COLUMN IF NOT EXISTS "category_id" uuid REFERENCES "wash_types"("id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_services_category_id_idx" ON "station_services" ("category_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_services_type_id_idx" ON "station_services" ("type_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_extras_category_id_idx" ON "station_extras" ("category_id");

--> statement-breakpoint
UPDATE "station_services" ss
SET "category_id" = wt.id
FROM "wash_types" wt
WHERE wt.code = ss.category AND ss.category_id IS NULL;

--> statement-breakpoint
UPDATE "station_services" ss
SET "type_id" = st.id
FROM "service_types" st
WHERE st.code = ss.service_type AND st.wash_type_id = ss.category_id AND ss.type_id IS NULL;

--> statement-breakpoint
UPDATE "station_extras" se
SET "category_id" = wt.id
FROM "wash_types" wt
WHERE wt.code = 'hand_wash' AND se.category_id IS NULL;
