-- Adds the wash bay assignment to reservations so availability can be computed
-- per post (no overlapping services on the same bay). Nullable: queue entries
-- and legacy reservations stay NULL and are excluded from per-post lookups.
-- ON DELETE SET NULL: deleting a post should not cascade-delete past bookings.

ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "post_id" uuid;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_post_id_station_posts_id_fk"
  FOREIGN KEY ("post_id") REFERENCES "station_posts"("id") ON DELETE SET NULL
  NOT VALID;

ALTER TABLE "reservations"
  VALIDATE CONSTRAINT "reservations_post_id_station_posts_id_fk";

CREATE INDEX IF NOT EXISTS "reservations_post_id_idx"
  ON "reservations" ("post_id")
  WHERE "post_id" IS NOT NULL;
