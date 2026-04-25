-- Migration 0034: Advanced indexes for T7-T10 performance optimization.
--
-- T7: GIN trigram indexes for ILIKE '%...%' full-text search on stations and vehicle_formats.
--     Requires pg_trgm extension. Replaces sequential scans on text search columns.
--
-- T8: Partial indexes covering high-selectivity filtered queries:
--     - pending_payment reservations filtered by status
--     - active queue entries filtered by entry_type and status
--     - visible ratings filtered by is_visible flag
--
-- T9: BRIN index on admin_logs.created_at (append-only, no prior B-tree index on this column).
--     reservations.created_at and support_tickets.created_at already have B-tree indexes from
--     migrations 0000 and 0033 respectively; BRIN duplicates on those columns are omitted because
--     the planner will always prefer the existing B-tree and the BRIN would just waste storage.
--
-- T10: Composite index for queue listing — supports the filtered, ordered scan used by
--      listQueueByStation (WHERE station_id, entry_type, status IN (...) ORDER BY queue_position).
--      An INCLUDE clause cannot produce index-only scans for SELECT * queries, so it is
--      omitted to avoid wasting index storage.
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block. These
--       statements are executed outside a transaction via apply-migration.mjs.
--       On a production table with existing data, run each CREATE INDEX statement
--       manually using CREATE INDEX CONCURRENTLY IF NOT EXISTS to avoid table locks.

--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stations_name_trgm_idx ON stations USING GIN (name gin_trgm_ops);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stations_city_trgm_idx ON stations USING GIN (city gin_trgm_ops);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stations_address_trgm_idx ON stations USING GIN (address gin_trgm_ops);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stations_description_trgm_idx ON stations USING GIN (description gin_trgm_ops);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS vehicle_formats_label_trgm_idx ON vehicle_formats USING GIN (label gin_trgm_ops);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS res_pending_payment_partial_idx ON reservations (created_at) WHERE status = 'pending_payment';

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS res_active_queue_partial_idx ON reservations (station_id, queue_position) WHERE entry_type = 'queue' AND status IN ('pending', 'confirmed', 'late');

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ratings_visible_partial_idx ON ratings (station_id, created_at DESC) WHERE is_visible = true;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS admin_logs_created_at_brin ON admin_logs USING BRIN (created_at);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS res_queue_covering_idx ON reservations (station_id, entry_type, status, queue_position);
