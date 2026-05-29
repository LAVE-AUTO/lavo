-- Migration 0050: persist rememberMe on refresh_tokens so session rotation does not silently
-- shrink long-lived sessions (bug #11). Existing rows are backfilled to false (default) so
-- behaviour for sessions issued before this column matches the previous heuristic.

--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "remember_me" boolean NOT NULL DEFAULT false;
