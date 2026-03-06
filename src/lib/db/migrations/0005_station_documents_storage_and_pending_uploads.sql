-- Migration 0005: station_documents.storage and pending_uploads table
-- storage: 'local' | 'cloudinary'; pending_uploads used by cron to sync local files to Cloudinary.

--> statement-breakpoint
ALTER TABLE "station_documents" ADD COLUMN "storage" varchar(20) NOT NULL DEFAULT 'cloudinary';

--> statement-breakpoint
ALTER TABLE "station_documents" ADD CONSTRAINT "check_storage" CHECK (storage IN ('local', 'cloudinary'));

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_uploads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "station_document_id" uuid NOT NULL REFERENCES "station_documents"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_uploads_created_at_idx" ON "pending_uploads" ("created_at");
