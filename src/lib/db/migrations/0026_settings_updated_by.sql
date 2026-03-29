-- %%%%% Migration 0026: Add updated_by column to settings %%%%%
-- Tracks which admin last modified each setting for audit purposes

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS updated_by uuid;


-- %%%%% Index for audit queries %%%%%
-- Speeds up audit log queries filtering by who changed what

CREATE INDEX IF NOT EXISTS settings_updated_by_idx ON settings (updated_by)
  WHERE updated_by IS NOT NULL;
