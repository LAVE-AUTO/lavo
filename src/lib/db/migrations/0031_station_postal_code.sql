-- %%%%% Migration 0031: Add postal_code column to stations table %%%%%
-- Allows station owners to store and update their postal code via PATCH /station/me.
-- Nullable varchar(20) to accommodate existing rows without a value.

ALTER TABLE "stations" ADD COLUMN IF NOT EXISTS "postal_code" varchar(20);
