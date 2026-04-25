-- %%%%% Migration 0033: Add missing B-tree indexes for performance optimization %%%%%
-- Covers hot lookup paths across auth, ratings, stations, reservations, support, and device tokens.
-- All statements use CREATE INDEX IF NOT EXISTS so the migration is safe to re-run.

--> statement-breakpoint
-- email_verification_tokens: token is used in WHERE clauses for verification and password-reset flows.
CREATE INDEX IF NOT EXISTS "email_verification_tokens_token_idx"
  ON "email_verification_tokens" ("token");

--> statement-breakpoint
-- refresh_tokens: user_id is filtered on every token rotation and revocation.
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx"
  ON "refresh_tokens" ("user_id");

--> statement-breakpoint
-- ratings: composite index supports the common filter pattern station_id + is_visible (public review list).
-- station_id is the leftmost prefix, so this index also covers station_id-only lookups (e.g. average
-- score computation). A separate single-column ratings_station_id_idx is therefore redundant and omitted.
CREATE INDEX IF NOT EXISTS "ratings_station_id_is_visible_idx"
  ON "ratings" ("station_id", "is_visible");

--> statement-breakpoint
-- ratings: created_at is used for chronological sorting.
CREATE INDEX IF NOT EXISTS "ratings_created_at_idx"
  ON "ratings" ("created_at");

--> statement-breakpoint
-- vehicle_formats: station_id is filtered when building the booking form or listing station formats.
CREATE INDEX IF NOT EXISTS "vehicle_formats_station_id_idx"
  ON "vehicle_formats" ("station_id");

--> statement-breakpoint
-- station_documents: station_id is filtered on every KYC document listing and approval check.
CREATE INDEX IF NOT EXISTS "station_documents_station_id_idx"
  ON "station_documents" ("station_id");

--> statement-breakpoint
-- stations: approved_at is filtered by admin dashboard queries that list recently approved stations.
CREATE INDEX IF NOT EXISTS "stations_approved_at_idx"
  ON "stations" ("approved_at");

--> statement-breakpoint
-- stations: updated_at is used for sorting and incremental sync queries.
CREATE INDEX IF NOT EXISTS "stations_updated_at_idx"
  ON "stations" ("updated_at");

--> statement-breakpoint
-- reservations: stripe_payment_id is used in webhook handlers to look up a reservation by Stripe event.
CREATE INDEX IF NOT EXISTS "reservations_stripe_payment_id_idx"
  ON "reservations" ("stripe_payment_id");

--> statement-breakpoint
-- reservations: completed_at is filtered for revenue reporting and completed-session queries.
CREATE INDEX IF NOT EXISTS "reservations_completed_at_idx"
  ON "reservations" ("completed_at");

--> statement-breakpoint
-- reservations: composite index supports station-level revenue aggregations filtered by completion date.
CREATE INDEX IF NOT EXISTS "reservations_station_id_completed_at_idx"
  ON "reservations" ("station_id", "completed_at");

--> statement-breakpoint
-- reservations: vehicle_format_id is joined when returning reservation details with format info.
CREATE INDEX IF NOT EXISTS "reservations_vehicle_format_id_idx"
  ON "reservations" ("vehicle_format_id");

--> statement-breakpoint
-- reservations: composite index supports the queue-position lookup for a given station and entry type.
CREATE INDEX IF NOT EXISTS "reservations_station_id_entry_type_queue_position_idx"
  ON "reservations" ("station_id", "entry_type", "queue_position");

--> statement-breakpoint
-- no_show_fees: station_id is filtered when listing outstanding fees for a station.
CREATE INDEX IF NOT EXISTS "no_show_fees_station_id_idx"
  ON "no_show_fees" ("station_id");

--> statement-breakpoint
-- no_show_fees: status is filtered to find pending fees eligible for collection.
CREATE INDEX IF NOT EXISTS "no_show_fees_status_idx"
  ON "no_show_fees" ("status");

--> statement-breakpoint
-- no_show_fees: created_at supports chronological listing and cron-based batch processing.
CREATE INDEX IF NOT EXISTS "no_show_fees_created_at_idx"
  ON "no_show_fees" ("created_at");

--> statement-breakpoint
-- support_tickets: created_at supports chronological listing and admin dashboard queries.
CREATE INDEX IF NOT EXISTS "support_tickets_created_at_idx"
  ON "support_tickets" ("created_at");

--> statement-breakpoint
-- support_tickets: updated_at supports sorting by most-recently-updated in the admin queue.
CREATE INDEX IF NOT EXISTS "support_tickets_updated_at_idx"
  ON "support_tickets" ("updated_at");

--> statement-breakpoint
-- support_messages: composite index supports paginated message history ordered by creation time.
CREATE INDEX IF NOT EXISTS "support_messages_ticket_id_created_at_idx"
  ON "support_messages" ("ticket_id", "created_at");

--> statement-breakpoint
-- device_tokens: drop the single-column user_id index created in migration 0029 now that the
-- composite index below supersedes it (user_id is the leftmost prefix of the composite, so all
-- user_id-only lookups are still served). No data is affected.
DROP INDEX IF EXISTS "device_tokens_user_id_idx";

--> statement-breakpoint
-- device_tokens: composite index supports per-user token listing ordered by registration time,
-- and doubles as the sole index for user_id-only lookups (leftmost prefix rule).
CREATE INDEX IF NOT EXISTS "device_tokens_user_id_created_at_idx"
  ON "device_tokens" ("user_id", "created_at");
