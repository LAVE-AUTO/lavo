DO $$
BEGIN
  CREATE TYPE booking_source AS ENUM ('standard', 'qr');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS booking_source booking_source NOT NULL DEFAULT 'standard';

DO $$
DECLARE
  current_type text;
BEGIN
  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
  INTO current_type
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'reservations'
    AND n.nspname = 'public'
    AND a.attname = 'booking_source'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF current_type IS DISTINCT FROM 'booking_source' THEN
    EXECUTE $sql$
      ALTER TABLE reservations
      ALTER COLUMN booking_source
      TYPE booking_source
      USING (
        CASE
          WHEN booking_source::text = 'qr' THEN 'qr'::booking_source
          ELSE 'standard'::booking_source
        END
      )
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS reservations_booking_source_idx
  ON reservations (booking_source);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_qr_zero_commission_chk'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_qr_zero_commission_chk
      CHECK (
        booking_source <> 'qr'
        OR (
          coalesce(commission_rate, 0)::numeric(5,4) = 0
          AND coalesce(commission_amount, 0)::numeric(10,2) = 0
        )
      );
  END IF;
END $$;
