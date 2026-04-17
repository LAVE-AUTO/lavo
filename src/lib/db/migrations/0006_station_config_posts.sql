-- Migration 0006: station_configs new columns (Figma-aligned) and station_posts table
-- station_configs: max_concurrent_posts, margin_before_minutes, margin_after_minutes
-- station_posts: per-station posts with position (1-based) and is_active

--> statement-breakpoint
ALTER TABLE "station_configs" ADD COLUMN "max_concurrent_posts" integer NOT NULL DEFAULT 1;

--> statement-breakpoint
ALTER TABLE "station_configs" ADD COLUMN "margin_before_minutes" integer NOT NULL DEFAULT 5;

--> statement-breakpoint
ALTER TABLE "station_configs" ADD COLUMN "margin_after_minutes" integer NOT NULL DEFAULT 10;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "station_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "station_posts_station_id_position_unique" ON "station_posts" ("station_id", "position");
