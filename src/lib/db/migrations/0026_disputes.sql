-- Migration 0026: disputes
-- Allows clients to open a dispute against a completed/paid reservation.
-- Admins can refund or close (resolve/reject) disputes.
-- One dispute per reservation (unique on reservation_id).

--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'refunded', 'resolved', 'rejected');

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disputes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reservation_id" uuid NOT NULL UNIQUE REFERENCES "reservations"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "description" text,
  "status" "dispute_status" NOT NULL DEFAULT 'open',
  "requested_amount" decimal(10, 2),
  "refunded_amount" decimal(10, 2),
  "stripe_refund_id" varchar(200),
  "closed_by" uuid REFERENCES "users"("id"),
  "closed_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_reservation_id_idx" ON "disputes" ("reservation_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_client_id_idx" ON "disputes" ("client_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_station_id_idx" ON "disputes" ("station_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_status_idx" ON "disputes" ("status");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_created_at_idx" ON "disputes" ("created_at");
