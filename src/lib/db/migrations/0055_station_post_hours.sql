CREATE TABLE IF NOT EXISTS "station_post_hours" (
	"station_post_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"morning_start" time,
	"morning_end" time,
	"afternoon_start" time,
	"afternoon_end" time,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "station_post_hours_station_post_id_day_of_week_pk" PRIMARY KEY("station_post_id","day_of_week")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "station_post_hours" ADD CONSTRAINT "station_post_hours_station_post_id_station_posts_id_fk" FOREIGN KEY ("station_post_id") REFERENCES "public"."station_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
