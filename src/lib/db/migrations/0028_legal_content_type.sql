-- %%%%% Migration 0028: Add 'legal' value to settings_type enum %%%%%
-- Legal content (CGU, privacy policy, legal notices) is stored in the settings table
-- using type='legal' and entity_id IS NULL (global scope).
-- This enum extension allows the existing settings table and unique index to serve
-- legal content without a separate table.

ALTER TYPE "public"."settings_type" ADD VALUE IF NOT EXISTS 'legal';
