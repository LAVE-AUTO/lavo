-- Walk-in client capture: when the merchant adds a client manually who is
-- not registered on the platform, we still record the email + optional
-- name on the reservation row so the receipt email can fire on completion
-- and so the merchant card can show who the queue is for. Registered
-- clients keep their entry tied to their real user_id (no walk-in fields).
--
-- Idempotent: re-running this migration is a no-op.

ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "walk_in_client_email" varchar(320);

ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "walk_in_client_name" varchar(200);

ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "walk_in_receipt_sent_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "reservations_walk_in_client_email_idx"
  ON "reservations" ("walk_in_client_email")
  WHERE "walk_in_client_email" IS NOT NULL;
