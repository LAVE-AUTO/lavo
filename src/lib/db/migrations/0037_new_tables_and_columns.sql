--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN IF NOT EXISTS "notification_prefs" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "favorites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "favorites_user_station_unique" ON "favorites" ("user_id", "station_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "station_hours" (
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "day_of_week" integer NOT NULL,
  "is_open" boolean NOT NULL DEFAULT true,
  "morning_start" time,
  "morning_end" time,
  "afternoon_start" time,
  "afternoon_end" time,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "station_hours_station_day_unique" ON "station_hours" ("station_id", "day_of_week");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "station_hour_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "exception_date" date NOT NULL,
  "reason" varchar(200) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "station_hour_exceptions_station_date_unique" ON "station_hour_exceptions" ("station_id", "exception_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_hour_exceptions_station_id_idx" ON "station_hour_exceptions" ("station_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" varchar(50) NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "action_url" varchar(500),
  "payload" jsonb,
  "read_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_notifications_user_read_created_idx" ON "user_notifications" ("user_id", "read_at", "created_at");
