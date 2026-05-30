--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "stripe_charge_id" varchar(200);
