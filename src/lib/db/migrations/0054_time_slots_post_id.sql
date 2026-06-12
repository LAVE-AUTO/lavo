ALTER TABLE "time_slots" ADD COLUMN IF NOT EXISTS "post_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_post_id_station_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."station_posts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
