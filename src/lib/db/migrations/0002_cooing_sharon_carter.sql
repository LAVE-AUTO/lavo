-- Make password_hash nullable (needed for OAuth users who have no password)
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
--> statement-breakpoint

-- Create auth_rate_limits table for DB-based rate limiting
CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key"           varchar(255) NOT NULL,
  "attempts"      integer NOT NULL DEFAULT 0,
  "blocked_until" timestamp with time zone,
  "created_at"    timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"    timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_rate_limits_key_idx" ON "auth_rate_limits" ("key");
