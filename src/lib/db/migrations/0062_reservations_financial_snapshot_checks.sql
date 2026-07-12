-- Guards the financial-snapshot columns added in 0061 (station_service_total, taxable_subtotal,
-- tps_amount, tvq_amount, client_total, platform_subtotal, platform_tax_amount,
-- platform_total_retained, station_subtotal, station_tax_amount, station_total_transferred):
-- several of them are algebraic combinations of the others and nothing enforced that identity,
-- so a partial write (e.g. a code path that forgets to set some of them) could silently desync
-- client_total from its components.
--
-- Added NOT VALID: this only guards future INSERT/UPDATE statements. Existing rows are not
-- re-checked at migration time, so this is safe to apply even if some historical rows (e.g.
-- from a code path fixed after these columns were introduced) don't yet satisfy the identity.
-- Run `ALTER TABLE reservations VALIDATE CONSTRAINT <name>` separately once historical data
-- has been reconciled, if full validation is ever needed.
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_taxable_subtotal_check"
    CHECK ("taxable_subtotal" = "station_service_total" + "platform_service_fee") NOT VALID,
  ADD CONSTRAINT "reservations_client_total_check"
    CHECK ("client_total" = "taxable_subtotal" + "tps_amount" + "tvq_amount") NOT VALID,
  ADD CONSTRAINT "reservations_platform_subtotal_check"
    CHECK ("platform_subtotal" = "commission_amount" + "platform_service_fee") NOT VALID,
  ADD CONSTRAINT "reservations_platform_total_retained_check"
    CHECK ("platform_total_retained" = "platform_subtotal" + "platform_tax_amount") NOT VALID,
  ADD CONSTRAINT "reservations_station_total_transferred_check"
    CHECK ("station_total_transferred" = "station_subtotal" + "station_tax_amount") NOT VALID,
  ADD CONSTRAINT "reservations_client_total_reconciliation_check"
    CHECK ("client_total" = "platform_total_retained" + "station_total_transferred") NOT VALID;
