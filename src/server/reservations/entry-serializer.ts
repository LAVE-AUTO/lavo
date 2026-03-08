/**
 * Shared entry serialization helpers for route handlers.
 * Prevents duplication of serializeEntry across 8 route files.
 */
import type { Entry } from './entry-repository';

/** Standard entry shape returned to users. */
export function serializeEntry(entry: Entry) {
  return {
    id: entry.id,
    entry_type: entry.entry_type,
    time_slot_id: entry.time_slot_id,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    status: entry.status,
    queue_position: entry.queue_position,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

/** Extended entry shape for station-side listing (includes user_id, completed_at). */
export function serializeStationEntry(entry: Entry) {
  return {
    id: entry.id,
    user_id: entry.user_id,
    entry_type: entry.entry_type,
    time_slot_id: entry.time_slot_id,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    status: entry.status,
    queue_position: entry.queue_position,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    completed_at: entry.completed_at,
  };
}
