-- Migration 0021: reservation tips
-- Dedicated table for client tips (pourboires) after completed reservations.
-- One tip per reservation (unique on reservation_id).
-- Transfer to station happens via Stripe destination charge (no platform commission).

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reservation_tips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reservation_id" uuid NOT NULL UNIQUE REFERENCES "reservations"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
  "amount" decimal(10, 2) NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'eur',
  "stripe_payment_intent_id" varchar(200) NOT NULL UNIQUE,
  "stripe_transfer_id" varchar(200),
  "status" varchar(30) NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_tips_client_id_idx" ON "reservation_tips" ("client_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_tips_station_id_idx" ON "reservation_tips" ("station_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_tips_status_idx" ON "reservation_tips" ("status");
