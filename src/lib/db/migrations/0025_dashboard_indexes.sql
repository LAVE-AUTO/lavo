-- Migration 0025: composite index on reservations for dashboard query performance.
-- Supports the pattern: WHERE status = $1 AND created_at BETWEEN $2 AND $3
-- The single-column reservations_status_idx already exists; this composite index
-- is more selective and avoids a separate sort on created_at for date-range filters.
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction (which Drizzle
-- wraps each migration in by default). CONCURRENTLY is omitted here so the migration
-- runs safely. On a large production table this index can be created manually outside
-- a transaction window using: CREATE INDEX CONCURRENTLY IF NOT EXISTS
-- reservations_status_created_at_idx ON reservations (status, created_at);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS reservations_status_created_at_idx
  ON reservations (status, created_at);
