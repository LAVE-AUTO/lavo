-- Migration 0066: add reservations.queued_at, distinct from created_at (booking
-- time, which can be days before the service date for a reservation later
-- downgraded to the queue) and from updated_at (bumped by unrelated
-- queue-position churn). Fixes the no-show cron's 2-day scan window
-- (listActiveQueueEntries), which was filtering on created_at and silently
-- never scanning reservations booked more than 2 days ahead once they were
-- downgraded to a late queue entry — those clients were never captured or
-- penalized, and their Stripe pre-authorization just expired on its own.

ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "queued_at" timestamptz;

-- Backfill existing queue rows: best-effort, no true downgrade timestamp is
-- recorded pre-migration, so created_at is the closest available signal.
UPDATE "reservations"
  SET "queued_at" = "created_at"
  WHERE "entry_type" = 'queue' AND "queued_at" IS NULL;

CREATE INDEX IF NOT EXISTS "reservations_queued_at_idx" ON "reservations" ("queued_at");
