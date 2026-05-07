-- Migration 0019: convert support_tickets.status from varchar to a proper enum.
-- This enforces valid status values at the DB level, matching the Drizzle schema.

--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "support_status" AS ENUM ('ouvert', 'en_cours', 'resolu', 'ferme');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint
ALTER TABLE "support_tickets"
  ALTER COLUMN "status" TYPE "support_status"
  USING "status"::"support_status";

--> statement-breakpoint
ALTER TABLE "support_tickets"
  ALTER COLUMN "status" SET DEFAULT 'ouvert'::"support_status";
