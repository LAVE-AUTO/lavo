-- Grace logins for unverified accounts: clients may sign in a limited number
-- of times (5) before email verification becomes mandatory. The counter is
-- incremented on each successful login while status = 'pending_verification'.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "unverified_login_count" integer NOT NULL DEFAULT 0;
