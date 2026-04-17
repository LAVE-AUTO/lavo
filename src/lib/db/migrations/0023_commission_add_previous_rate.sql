-- Add previous_rate to commission_settings for full audit trail.
-- Nullable: the first entry has no predecessor.
ALTER TABLE "commission_settings" ADD COLUMN "previous_rate" numeric(5, 4);
