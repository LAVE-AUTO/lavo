-- %%%%% Migration 0032: Introduce dedicated station_photos table %%%%%
-- Photos were previously stored in station_documents (document_type = 'photo').
-- This migration creates the new table, moves existing photo rows, then removes them from station_documents.
--
-- The DDL statements (CREATE TABLE / CREATE INDEX) must precede the data-migration
-- transaction because DDL cannot be mixed with DML inside the same transaction block
-- in all Postgres configurations. The INSERT + DELETE that move the data are wrapped
-- in an explicit BEGIN/COMMIT so they succeed or fail atomically: no orphan rows in
-- station_photos and no premature deletion from station_documents on partial failure.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "station_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_photos_station_id_idx" ON "station_photos" ("station_id");

--> statement-breakpoint
BEGIN;

INSERT INTO "station_photos" ("id", "station_id", "url", "position", "created_at")
SELECT
  "id",
  "station_id",
  "file_url" AS "url",
  (ROW_NUMBER() OVER (PARTITION BY "station_id" ORDER BY "created_at") - 1)::integer AS "position",
  "created_at"
FROM "station_documents"
WHERE "document_type" = 'photo';

DELETE FROM "station_documents" WHERE "document_type" = 'photo';

COMMIT;
