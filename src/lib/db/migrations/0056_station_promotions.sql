-- Canonical station promotions and persistent client enrollments for QR-driven promo signup.

CREATE TABLE IF NOT EXISTS "station_promotions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE cascade,
  "created_by_admin_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "commission_rate" numeric(5,4) NOT NULL,
  "ref_code" varchar(128) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "expires_at" timestamptz NOT NULL,
  "deactivated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "station_promotions_ref_code_unique" UNIQUE("ref_code")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_promotions_station_id_idx"
  ON "station_promotions" ("station_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_promotions_station_id_active_idx"
  ON "station_promotions" ("station_id", "is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_promotions_expires_at_idx"
  ON "station_promotions" ("expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "station_promotions_one_active_per_station_idx"
  ON "station_promotions" ("station_id")
  WHERE "is_active" = true;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "station_promotion_enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "station_id" uuid NOT NULL REFERENCES "stations"("id") ON DELETE cascade,
  "promotion_id" uuid NOT NULL REFERENCES "station_promotions"("id") ON DELETE cascade,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "station_promo_enrollments_user_station_unique"
  ON "station_promotion_enrollments" ("user_id", "station_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_promo_enrollments_user_station_idx"
  ON "station_promotion_enrollments" ("user_id", "station_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_promo_enrollments_promotion_id_idx"
  ON "station_promotion_enrollments" ("promotion_id");
