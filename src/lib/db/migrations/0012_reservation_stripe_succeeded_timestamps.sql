-- Migration 0012: add Stripe PaymentIntent succeeded timestamps for idempotence + weekly reporting.
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "stripe_payment_succeeded_at" timestamp with time zone;

--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "stripe_payment_succeeded_notified_at" timestamp with time zone;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_stripe_payment_succeeded_at_idx" ON "reservations" ("stripe_payment_succeeded_at");
