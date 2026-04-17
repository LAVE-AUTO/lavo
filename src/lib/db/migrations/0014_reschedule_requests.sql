-- Migration 0014: add reschedule_requests table for reservation rescheduling audit trail.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reschedule_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "original_reservation_id" uuid NOT NULL REFERENCES "reservations"("id") ON DELETE CASCADE,
  "new_reservation_id" uuid NOT NULL REFERENCES "reservations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "had_penalty" boolean NOT NULL DEFAULT false,
  "penalty_amount" decimal(10, 2),
  "refunded_amount" decimal(10, 2),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reschedule_requests_original_reservation_id_idx" ON "reschedule_requests" ("original_reservation_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reschedule_requests_new_reservation_id_idx" ON "reschedule_requests" ("new_reservation_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reschedule_requests_user_id_idx" ON "reschedule_requests" ("user_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reschedule_requests_station_id_idx" ON "reschedule_requests" ("station_id");
