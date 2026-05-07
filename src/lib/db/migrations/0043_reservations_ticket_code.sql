-- Adds a 6-character service code to reservations (queue + reservation entries).
-- Shown to the client on the receipt; required by the station to start the
-- service via POST /api/v1/station/entries/:id/start { code }.
-- Existing rows stay NULL (legacy entries don't get a retroactive code).

ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "ticket_code" varchar(6);

CREATE INDEX IF NOT EXISTS "reservations_ticket_code_station_idx"
  ON "reservations" ("station_id", "ticket_code")
  WHERE "ticket_code" IS NOT NULL;
