-- %%%%% Migration 0027: Add updated_by column to settings + rename tip_max_amount key %%%%%
-- Tracks which admin last modified each setting for audit purposes.
-- Also renames the legacy tip_max_amount key to the canonical max_tip_amount_xaf.

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS updated_by uuid;


-- %%%%% Index for audit queries %%%%%
-- Speeds up audit log queries filtering by who changed what

CREATE INDEX IF NOT EXISTS settings_updated_by_idx ON settings (updated_by)
  WHERE updated_by IS NOT NULL;


-- %%%%% Rename legacy tip key %%%%%
-- The platform settings API uses max_tip_amount_xaf; existing rows with the old key
-- would be silently ignored by the new code. Rename in-place to avoid orphaning.

UPDATE settings
  SET key = 'max_tip_amount_xaf'
  WHERE type = 'admin'
    AND key = 'tip_max_amount'
    AND entity_id IS NULL;
