DROP INDEX IF EXISTS "settings_type_entity_key_idx";--> statement-breakpoint
ALTER TABLE "station_configs" ADD COLUMN "break_start" time with time zone;--> statement-breakpoint
ALTER TABLE "station_configs" ADD COLUMN "break_end" time with time zone;--> statement-breakpoint
ALTER TABLE "station_configs" ADD COLUMN "cancellation_delay_minutes" integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "settings_type_key_global_idx" ON "settings" USING btree ("type","key") WHERE "settings"."entity_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "settings_type_entity_key_idx" ON "settings" USING btree ("type","entity_id","key") WHERE "settings"."entity_id" is not null;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_score_range" CHECK ("ratings"."score" >= 1 AND "ratings"."score" <= 5);