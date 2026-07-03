-- Repairs support_tickets on databases where the table pre-existed migration
-- 0018_support_system (its `CREATE TABLE IF NOT EXISTS` skipped column creation),
-- leaving the table without ticket_number / priority / category. Selecting those
-- columns (support list/detail) then failed with "column does not exist" (HTTP 500).
--
-- Idempotent: safe on both drifted databases and fresh deploys where 0018 already
-- created the columns.

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "ticket_number" varchar(20);
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "priority" "support_priority" NOT NULL DEFAULT 'normal';
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "category" "support_category" NOT NULL DEFAULT 'autre';
--> statement-breakpoint
-- Backfill any pre-existing rows missing a ticket number so NOT NULL + UNIQUE hold.
UPDATE "support_tickets"
  SET "ticket_number" = 'SUP-' || upper(substr(md5(random()::text || id::text), 1, 8))
  WHERE "ticket_number" IS NULL;
--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "ticket_number" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_ticket_number_unique" ON "support_tickets" ("ticket_number");
