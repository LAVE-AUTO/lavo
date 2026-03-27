-- Drop the currency column from reservation_tips.
-- Currency is a Stripe concern — the platform has a single currency configured
-- via the platform_currency setting. There is no value in storing it per tip row.
ALTER TABLE "reservation_tips" DROP COLUMN IF EXISTS "currency";
