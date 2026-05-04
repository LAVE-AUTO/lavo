-- Migration 0035: Create materialized view station_stats for T23 performance optimization.
--
-- Replaces correlated subqueries in listActiveStations / listActiveStationsGroup with a
-- precomputed JOIN target. The view is refreshed concurrently after reservation completions
-- and rating inserts via fire-and-forget calls in the relevant services.
--
-- The unique index on station_id is required for REFRESH MATERIALIZED VIEW CONCURRENTLY.

--> statement-breakpoint
CREATE MATERIALIZED VIEW IF NOT EXISTS station_stats AS
SELECT
  s.id AS station_id,
  COALESCE(
    (SELECT SUM(ts.capacity - ts.booked_count)
     FROM time_slots ts
     WHERE ts.station_id = s.id AND ts.start_time > now() AND ts.status = 'available'),
    0
  ) AS available_slots,
  COALESCE(
    (SELECT COUNT(*)
     FROM reservations r
     WHERE r.station_id = s.id AND r.completed_at IS NOT NULL),
    0
  ) AS completed_count,
  COALESCE(
    (SELECT AVG(rt.score)
     FROM ratings rt
     WHERE rt.station_id = s.id AND rt.is_visible = true),
    0
  ) AS average_rating,
  COALESCE(
    (SELECT COUNT(*)
     FROM ratings rt
     WHERE rt.station_id = s.id AND rt.is_visible = true),
    0
  ) AS total_ratings
FROM stations s
WHERE s.status = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS station_stats_station_id_idx ON station_stats (station_id);
