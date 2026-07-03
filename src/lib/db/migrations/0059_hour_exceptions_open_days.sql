-- Lets a station hour exception describe an OPEN day (all day or with special
-- hours) instead of only a closed day. is_open=false keeps the legacy
-- closed-day behaviour; is_open=true with open_time/close_time NULL means open
-- all day; with both times set means open on special hours.

ALTER TABLE "station_hour_exceptions" ADD COLUMN IF NOT EXISTS "is_open" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "station_hour_exceptions" ADD COLUMN IF NOT EXISTS "open_time" time;
--> statement-breakpoint
ALTER TABLE "station_hour_exceptions" ADD COLUMN IF NOT EXISTS "close_time" time;
