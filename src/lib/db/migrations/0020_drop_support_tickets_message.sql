-- Migration 0020: remove the redundant message column from support_tickets.
-- The initial message content lives in support_messages (first row per ticket).

--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN IF EXISTS "message";
