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

/** Client-facing rich entry shape: denormalized station, vehicle format, slot times, and computed flags. */
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
    completed_at: entry.completed_at?.toISOString() ?? null,
    station: entry.station,
    vehicle_format: entry.vehicle_format,
    service: entry.service,
    is_rated: entry.is_rated,
    is_tipped: entry.is_tipped,
    estimated_wait_minutes: entry.estimated_wait_minutes,
    slot_start_time: entry.slot_start_time?.toISOString() ?? null,
    slot_end_time: entry.slot_end_time?.toISOString() ?? null,
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
    post_id: entry.post_id,
    status: entry.status,
    queue_position: entry.queue_position,
    ticket_code: entry.ticket_code,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    completed_at: entry.completed_at,
  };
}

/** Station-side rich entry: adds denormalized user name, vehicle format, and slot times. */
export function serializeRichStationEntry(entry: RichStationEntry) {
  /* Walk-ins are identified by the presence of walk_in_client_* columns,
   * not by the absence of a Stripe PI (which is also null for entries whose
   * payment intent was never created — failed/pending standard reservations).
   * Matched walk-ins (email resolved to a real account) have these fields
   * cleared to null so they behave as regular entries. */
  const isWalkIn = Boolean(entry.walk_in_client_email) || Boolean(entry.walk_in_client_name);
  return {
    id: entry.id,
    user_id: entry.user_id,
    entry_type: entry.entry_type,
    booking_source: entry.booking_source,
    time_slot_id: entry.time_slot_id,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    post_id: entry.post_id,
    status: entry.status,
    queue_position: entry.queue_position,
    ticket_code: entry.ticket_code,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    completed_at: entry.completed_at,
    slot_start_time: entry.slot_start_time?.toISOString() ?? null,
    slot_end_time: entry.slot_end_time?.toISOString() ?? null,
    user: { first_name: entry.user_first_name, last_name: entry.user_last_name },
    vehicle_format: entry.vehicle_format,
    service: entry.service,
    /* Walk-in client identity (filled only when the email did not
     * match a registered account). The merchant card uses it to show
     * 'Marie Dupont' / 'marie@example.com' instead of a placeholder. */
    walk_in_client_email: entry.walk_in_client_email,
    walk_in_client_name: entry.walk_in_client_name,
    is_walk_in: isWalkIn,
  };
}
