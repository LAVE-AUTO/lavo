ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "station_service_total" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "platform_service_fee" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "taxable_subtotal" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "tps_amount" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "tvq_amount" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "client_total" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "platform_subtotal" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "platform_tax_amount" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "platform_total_retained" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "station_subtotal" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "station_tax_amount" numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "station_total_transferred" numeric(10, 2) NOT NULL DEFAULT 0.00;

UPDATE "reservations"
SET
  "station_service_total" = CASE
    WHEN COALESCE("station_service_total", 0.00) = 0.00 THEN COALESCE("amount_paid", 0.00)
    ELSE "station_service_total"
  END,
  "platform_service_fee" = COALESCE("platform_service_fee", 0.00),
  "taxable_subtotal" = CASE
    WHEN COALESCE("taxable_subtotal", 0.00) = 0.00 THEN COALESCE("amount_paid", 0.00)
    ELSE "taxable_subtotal"
  END,
  "tps_amount" = COALESCE("tps_amount", 0.00),
  "tvq_amount" = COALESCE("tvq_amount", 0.00),
  "client_total" = CASE
    WHEN COALESCE("client_total", 0.00) = 0.00 THEN COALESCE("amount_paid", 0.00)
    ELSE "client_total"
  END,
  "platform_subtotal" = CASE
    WHEN COALESCE("platform_subtotal", 0.00) = 0.00 THEN COALESCE("commission_amount", 0.00)
    ELSE "platform_subtotal"
  END,
  "platform_tax_amount" = COALESCE("platform_tax_amount", 0.00),
  "platform_total_retained" = CASE
    WHEN COALESCE("platform_total_retained", 0.00) = 0.00 THEN COALESCE("commission_amount", 0.00)
    ELSE "platform_total_retained"
  END,
  "station_subtotal" = CASE
    WHEN COALESCE("station_subtotal", 0.00) = 0.00 THEN COALESCE("station_payout", 0.00)
    ELSE "station_subtotal"
  END,
  "station_tax_amount" = COALESCE("station_tax_amount", 0.00),
  "station_total_transferred" = CASE
    WHEN COALESCE("station_total_transferred", 0.00) = 0.00 THEN COALESCE("station_payout", 0.00)
    ELSE "station_total_transferred"
  END;
