/**
 * Shared entry serialization helpers for route handlers.
 * Prevents duplication of serializeEntry across 8 route files.
 */
import type { Entry, RichEntry, RichStationEntry } from './entry-repository';

/** Standard entry shape returned to users. */
export function serializeEntry(entry: Entry) {
  return {
    id: entry.id,
    entry_type: entry.entry_type,
    booking_source: entry.booking_source,
    time_slot_id: entry.time_slot_id,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    status: entry.status,
    queue_position: entry.queue_position,
    ticket_code: entry.ticket_code,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

/** Client-facing rich entry shape: denormalized station, vehicle format, and computed flags. */
export function serializeRichEntry(entry: RichEntry) {
  return {
    id: entry.id,
    entry_type: entry.entry_type,
    booking_source: entry.booking_source,
    time_slot_id: entry.time_slot_id,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    status: entry.status,
    queue_position: entry.queue_position,
    ticket_code: entry.ticket_code,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    station: entry.station,
    vehicle_format: entry.vehicle_format,
    is_rated: entry.is_rated,
    is_tipped: entry.is_tipped,
    estimated_wait_minutes: entry.estimated_wait_minutes,
  };
}

/** Extended entry shape for station-side listing (includes user_id, completed_at). */
export function serializeStationEntry(entry: Entry) {
  return {
    id: entry.id,
    user_id: entry.user_id,
    entry_type: entry.entry_type,
    booking_source: entry.booking_source,
    time_slot_id: entry.time_slot_id,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    status: entry.status,
    queue_position: entry.queue_position,
    ticket_code: entry.ticket_code,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    completed_at: entry.completed_at,
  };
}

/** Station-side rich entry: adds denormalized user first_name and vehicle format. */
export function serializeRichStationEntry(entry: RichStationEntry) {
  return {
    id: entry.id,
    user_id: entry.user_id,
    entry_type: entry.entry_type,
    booking_source: entry.booking_source,
    time_slot_id: entry.time_slot_id,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    status: entry.status,
    queue_position: entry.queue_position,
    ticket_code: entry.ticket_code,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    completed_at: entry.completed_at,
    user: { first_name: entry.user_first_name },
    vehicle_format: entry.vehicle_format,
  };
}
