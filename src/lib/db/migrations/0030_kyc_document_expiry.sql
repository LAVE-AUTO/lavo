-- %%%%% Migration 0030: Add KYC document expiry tracking columns %%%%%
-- Adds expiry_date, reminder_first_sent_at, and reminder_second_sent_at to station_documents.
-- expiry_date is set during station approval (admin provides per-document dates).
-- reminder_*_sent_at columns act as anti-duplicate flags for the KYC expiry cron job.

ALTER TABLE "station_documents" ADD COLUMN IF NOT EXISTS "expiry_date" date;

--> statement-breakpoint
ALTER TABLE "station_documents" ADD COLUMN IF NOT EXISTS "reminder_first_sent_at" timestamptz;

--> statement-breakpoint
ALTER TABLE "station_documents" ADD COLUMN IF NOT EXISTS "reminder_second_sent_at" timestamptz;


-- %%%%% Indexes %%%%%
-- Speeds up the daily cron scan for documents approaching expiry
CREATE INDEX IF NOT EXISTS "station_documents_expiry_date_idx" ON "station_documents" ("expiry_date");
