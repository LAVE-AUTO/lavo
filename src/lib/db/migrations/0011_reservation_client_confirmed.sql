-- Migration 0011: add client_confirmed to reservations for presence confirmation flow.
-- Defaults to false; set to true when the client confirms presence before service start.

--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "client_confirmed" boolean NOT NULL DEFAULT false;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_client_confirmed_idx" ON "reservations" ("client_confirmed");
