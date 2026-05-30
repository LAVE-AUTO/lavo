-- Migration 0051: track Stripe-side failures on reservations so a reconciliation cron can
-- find and retry them, instead of relying solely on log scraping.
--
-- - pi_cancel_failed_at:    set when cancelPaymentIntent() throws for a reservation that
--                           must release its authorization hold (bug #12). Cleared once
--                           the reconciliation cron successfully cancels the PI.
-- - refund_persist_failed_at: set when Stripe.refunds.create() succeeded but updating
--                           stripe_refund_id failed (bug #26). Cleared once the refund id
--                           is persisted from a Stripe lookup.

--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "pi_cancel_failed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "refund_persist_failed_at" timestamp with time zone;

-- Partial indexes restrict storage and seek time to only the rows the reconciliation cron
-- actually needs to scan (typically 0–few rows).
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_pi_cancel_failed_idx"
  ON "reservations" ("pi_cancel_failed_at")
  WHERE "pi_cancel_failed_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_refund_persist_failed_idx"
  ON "reservations" ("refund_persist_failed_at")
  WHERE "refund_persist_failed_at" IS NOT NULL;
