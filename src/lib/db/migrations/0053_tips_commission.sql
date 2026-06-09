-- Add commission tracking columns to reservation_tips.
-- Tips now carry an application_fee_amount (same active rate as reservations)
-- so the platform covers Stripe processing fees and earns revenue on tips.

ALTER TABLE reservation_tips
  ADD COLUMN commission_rate   NUMERIC(8, 4)          NOT NULL DEFAULT 0,
  ADD COLUMN commission_amount NUMERIC(10, 2)         NOT NULL DEFAULT 0,
  ADD COLUMN station_payout    NUMERIC(10, 2)         NOT NULL DEFAULT 0;
