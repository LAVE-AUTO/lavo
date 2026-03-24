ALTER TABLE reservations
  ALTER COLUMN commission_amount SET DEFAULT 0,
  ALTER COLUMN station_payout SET DEFAULT 0;

UPDATE reservations
SET
  commission_amount = COALESCE(commission_amount, 0),
  station_payout = COALESCE(station_payout, 0)
WHERE commission_amount IS NULL
   OR station_payout IS NULL;

ALTER TABLE reservations
  ALTER COLUMN commission_amount SET NOT NULL,
  ALTER COLUMN station_payout SET NOT NULL;
