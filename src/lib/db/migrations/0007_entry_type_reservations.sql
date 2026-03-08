-- Migration 0007: entry_type on reservations (reservation | queue), nullable time_slot_id,
-- reservation_surcharge on station_configs. Constraint: reservation => time_slot_id NOT NULL;
-- queue => queue_position NOT NULL.

--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('reservation', 'queue');

--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "entry_type" "public"."entry_type" NOT NULL DEFAULT 'reservation';

--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "time_slot_id" DROP NOT NULL;

--> statement-breakpoint
ALTER TABLE "station_configs" ADD COLUMN "reservation_surcharge" numeric(10, 2);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_entry_type_station_idx" ON "reservations" ("entry_type", "station_id");

--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_entry_type_check" CHECK (
  (entry_type = 'reservation' AND time_slot_id IS NOT NULL)
  OR (entry_type = 'queue' AND queue_position IS NOT NULL)
);
