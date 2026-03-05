-- Migration 0004: station onboarding
-- - users: make first_name/last_name nullable, add force_password_change
-- - users: add CHECK to enforce names for client role only
-- - stations: add user_id FK, wash_type enum, description, wash_post_count
-- - Create station_documents table

--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "first_name" DROP NOT NULL;

--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_name" DROP NOT NULL;

--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "force_password_change" boolean NOT NULL DEFAULT false;

--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "check_client_has_names"
  CHECK (role != 'client' OR (first_name IS NOT NULL AND last_name IS NOT NULL));

--> statement-breakpoint
CREATE TYPE "wash_type" AS ENUM ('hand_wash', 'automatic', 'self_service');

--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "user_id" uuid REFERENCES "users"("id");

--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "wash_type" "wash_type";

--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "description" text;

--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "wash_post_count" integer;

--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "is_open" SET DEFAULT false;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stations_user_id_idx" ON "stations" ("user_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "station_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "document_type" varchar(50) NOT NULL,
  "file_url" text NOT NULL,
  "terms_accepted" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
