-- Deduplicate vehicle_formats by normalized label and enforce a
-- case-insensitive uniqueness going forward.
--
-- Rule: two formats are duplicates when lower(btrim(label)) is equal.
--       'SUV', 'suv', '  Suv ', 'sUv' all collapse to the same key.
--
-- For each duplicate group we keep the oldest row (lowest created_at),
-- re-point every FK reference (reservations, service_vehicle_entries,
-- extra_vehicle_entries) to that kept row, then delete the rest.
--
-- The unique expression index added at the end blocks future
-- duplicates at the DB layer regardless of what the application sends.
--
-- Idempotent: re-running this migration after it has been applied
-- once is a no-op (the dedup loop finds no groups with count > 1 and
-- the index uses IF NOT EXISTS).

BEGIN;

/* 1. Trim leading/trailing whitespace in every label so the unique
   index does not get tripped by ' SUV' vs 'SUV'. */
UPDATE "vehicle_formats"
SET    "label" = btrim("label"),
       "updated_at" = NOW()
WHERE  "label" <> btrim("label");

/* 2. Merge duplicates into the oldest row of each group, repointing
   every FK reference on the way. */
DO $$
DECLARE
  dup RECORD;
  kept_id uuid;
BEGIN
  FOR dup IN
    SELECT lower(btrim(label)) AS key
    FROM   "vehicle_formats"
    GROUP  BY lower(btrim(label))
    HAVING count(*) > 1
  LOOP
    /* Pick the oldest row of the group as the survivor. */
    SELECT id INTO kept_id
    FROM   "vehicle_formats"
    WHERE  lower(btrim(label)) = dup.key
    ORDER  BY created_at ASC, id ASC
    LIMIT  1;

    /* a) Reservations: simple repoint. No unique constraint on
          (reservation, vehicle_format_id) so UPDATE is safe. */
    UPDATE "reservations"
       SET "vehicle_format_id" = kept_id
     WHERE "vehicle_format_id" IN (
             SELECT id FROM "vehicle_formats"
              WHERE lower(btrim(label)) = dup.key AND id <> kept_id
           );

    /* b) service_vehicle_entries: same, no unique constraint. */
    UPDATE "service_vehicle_entries"
       SET "vehicle_format_id" = kept_id
     WHERE "vehicle_format_id" IN (
             SELECT id FROM "vehicle_formats"
              WHERE lower(btrim(label)) = dup.key AND id <> kept_id
           );

    /* c) extra_vehicle_entries has a unique (extra_id, vehicle_format_id)
          constraint, so collapse any extra rows that would collide with
          the kept row BEFORE we run the UPDATE. */
    DELETE FROM "extra_vehicle_entries"
     WHERE "vehicle_format_id" IN (
             SELECT id FROM "vehicle_formats"
              WHERE lower(btrim(label)) = dup.key AND id <> kept_id
           )
       AND "extra_id" IN (
             SELECT "extra_id" FROM "extra_vehicle_entries"
              WHERE "vehicle_format_id" = kept_id
           );

    UPDATE "extra_vehicle_entries"
       SET "vehicle_format_id" = kept_id
     WHERE "vehicle_format_id" IN (
             SELECT id FROM "vehicle_formats"
              WHERE lower(btrim(label)) = dup.key AND id <> kept_id
           );

    /* d) Delete the now-orphaned duplicate format rows. */
    DELETE FROM "vehicle_formats"
     WHERE lower(btrim(label)) = dup.key
       AND id <> kept_id;
  END LOOP;
END $$;

/* 3. Block future duplicates regardless of casing or surrounding
      whitespace. Expression index on lower(btrim(label)) — Postgres
      enforces it during INSERT / UPDATE. */
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_formats_label_normalized_unique"
  ON "vehicle_formats" (lower(btrim("label")));

COMMIT;
