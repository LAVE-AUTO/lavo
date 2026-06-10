CREATE TABLE IF NOT EXISTS "station_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"plan_id" varchar(64) NOT NULL,
	"plan_name" varchar(80),
	"interval" varchar(10) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"stripe_customer_id" varchar(100),
	"stripe_subscription_id" varchar(100),
	"status" varchar(30) DEFAULT 'incomplete' NOT NULL,
	"current_period_end" timestamp with time zone,
	"warn_email_sent_at" timestamp with time zone,
	"pending_decision_at" timestamp with time zone,
	"admin_decision" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "station_subscriptions" ADD CONSTRAINT "station_subscriptions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "station_subscriptions_station_id_unique" ON "station_subscriptions" ("station_id");
