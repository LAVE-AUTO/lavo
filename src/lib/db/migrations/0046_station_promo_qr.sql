-- Adds promo QR fields to stations so admins can generate and persist referral QR codes.

ALTER TABLE "stations"
  ADD COLUMN IF NOT EXISTS "promo_commission_rate" numeric(5,4),
  ADD COLUMN IF NOT EXISTS "promo_ref_code" varchar(128),
  ADD COLUMN IF NOT EXISTS "promo_ref_generated_at" timestamptz;

CREATE INDEX IF NOT EXISTS "stations_promo_ref_code_idx"
  ON "stations" ("promo_ref_code");
