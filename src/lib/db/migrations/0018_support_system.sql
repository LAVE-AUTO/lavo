-- Migration 0018: support ticket system
-- Creates support_priority and support_category enums,
-- plus support_tickets, support_messages, and support_settings tables.

--> statement-breakpoint
CREATE TYPE "support_priority" AS ENUM ('bas', 'normal', 'urgent');

--> statement-breakpoint
CREATE TYPE "support_category" AS ENUM ('technique', 'facturation', 'bug', 'autre');

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_number" varchar(20) NOT NULL UNIQUE,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "assigned_to" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "subject" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'ouvert',
  "priority" "support_priority" NOT NULL DEFAULT 'normal',
  "category" "support_category" NOT NULL DEFAULT 'autre',
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_created_by_idx" ON "support_tickets" ("created_by");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_assigned_to_idx" ON "support_tickets" ("assigned_to");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets" ("status");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "sender_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "is_from_admin" boolean NOT NULL DEFAULT false,
  "content" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_messages_ticket_id_idx" ON "support_messages" ("ticket_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" varchar(100) NOT NULL UNIQUE,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
