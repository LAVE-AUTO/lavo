-- Migration 0065: relax the queue_position NOT NULL check so that queue
-- entries in terminal / payment-in-flight statuses can have a NULL
-- queue_position. The application already sets queue_position to NULL
-- when cancelling queue entries (payment_failed, refunded, cancelled, ...)
-- and when moving an entry to in_progress. The old constraint
-- reservations_entry_type_check required queue_position IS NOT NULL for
-- every queue row, which made those valid state transitions fail.
--
-- Active queue statuses that still require a position: pending, confirmed, late.

ALTER TABLE "reservations"
  DROP CONSTRAINT IF EXISTS "reservations_entry_type_check";

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_entry_type_check" CHECK (
    (entry_type = 'reservation' AND time_slot_id IS NOT NULL)
    OR (entry_type = 'queue' AND (queue_position IS NOT NULL OR status NOT IN ('pending', 'confirmed', 'late')))
  );
