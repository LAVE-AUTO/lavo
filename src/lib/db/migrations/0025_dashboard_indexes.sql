-- Migration 0021: composite index on reservations for dashboard query performance.
-- Supports the pattern: WHERE status = $1 AND created_at BETWEEN $2 AND $3
-- The single-column reservations_status_idx already exists; this composite index
-- is more selective and avoids a separate sort on created_at for date-range filters.
-- CONCURRENTLY avoids a full table lock in production.

--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS reservations_status_created_at_idx
  ON reservations (status, created_at);
