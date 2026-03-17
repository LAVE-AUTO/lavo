-- Migration 0010: add stripe_refund_id to reservations for refund tracking on cancellation.

--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "stripe_refund_id" varchar(200);
