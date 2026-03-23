-- Migration 0013: add delay_requests table for client late-signaling workflow.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delay_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reservation_id" uuid NOT NULL REFERENCES "reservations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "message" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delay_requests_reservation_id_idx" ON "delay_requests" ("reservation_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delay_requests_station_id_idx" ON "delay_requests" ("station_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delay_requests_user_id_idx" ON "delay_requests" ("user_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delay_requests_status_idx" ON "delay_requests" ("status");
