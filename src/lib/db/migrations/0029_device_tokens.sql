-- %%%%% Migration 0029: Add device_tokens table %%%%%
-- Stores FCM push notification tokens per user device.
-- Supports iOS, Android, and web push targets.
-- Token is unique globally: one device can only be associated with one user at a time.

CREATE TABLE IF NOT EXISTS device_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       varchar(500) NOT NULL UNIQUE,
  platform    varchar(20) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- %%%%% Indexes %%%%%
-- Speeds up lookups by user when sending push notifications
CREATE INDEX IF NOT EXISTS device_tokens_user_id_idx ON device_tokens (user_id);

-- Speeds up token existence checks during upsert and cleanup
CREATE INDEX IF NOT EXISTS device_tokens_token_idx ON device_tokens (token);
