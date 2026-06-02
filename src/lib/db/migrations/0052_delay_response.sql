-- Migration 0052: richer station response to a client delay request.
--
-- - accept_message:     station's message shown to the client when the delay is accepted.
-- - max_delay_minutes:  maximum extra delay (in minutes) the station tolerates on acceptance;
--                       beyond it the client is invited to reschedule instead.
--
-- refusal_reason already exists for the refuse path and is now treated as the
-- (required) refusal message surfaced to the client.

ALTER TABLE delay_requests ADD COLUMN IF NOT EXISTS accept_message text;
ALTER TABLE delay_requests ADD COLUMN IF NOT EXISTS max_delay_minutes integer;
