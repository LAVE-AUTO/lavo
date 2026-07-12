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
    station_service_total: entry.station_service_total,
    platform_service_fee: entry.platform_service_fee,
    taxable_subtotal: entry.taxable_subtotal,
    tps_amount: entry.tps_amount,
    tvq_amount: entry.tvq_amount,
    client_total: entry.client_total,
    commission_rate: entry.commission_rate,
    commission_amount: entry.commission_amount,
    platform_subtotal: entry.platform_subtotal,
    platform_tax_amount: entry.platform_tax_amount,
    platform_total_retained: entry.platform_total_retained,
    station_payout: entry.station_payout,
    station_subtotal: entry.station_subtotal,
    station_tax_amount: entry.station_tax_amount,
    station_total_transferred: entry.station_total_transferred,
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
    station_service_total: entry.station_service_total,
    platform_service_fee: entry.platform_service_fee,
    taxable_subtotal: entry.taxable_subtotal,
    tps_amount: entry.tps_amount,
    tvq_amount: entry.tvq_amount,
    client_total: entry.client_total,
    commission_rate: entry.commission_rate,
    commission_amount: entry.commission_amount,
    platform_subtotal: entry.platform_subtotal,
    platform_tax_amount: entry.platform_tax_amount,
    platform_total_retained: entry.platform_total_retained,
    station_payout: entry.station_payout,
    station_subtotal: entry.station_subtotal,
    station_tax_amount: entry.station_tax_amount,
    station_total_transferred: entry.station_total_transferred,
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
    delay_request: entry.delay_request,
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
    station_service_total: entry.station_service_total,
    platform_service_fee: entry.platform_service_fee,
    taxable_subtotal: entry.taxable_subtotal,
    tps_amount: entry.tps_amount,
    tvq_amount: entry.tvq_amount,
    client_total: entry.client_total,
    commission_rate: entry.commission_rate,
    commission_amount: entry.commission_amount,
    platform_subtotal: entry.platform_subtotal,
    platform_tax_amount: entry.platform_tax_amount,
    platform_total_retained: entry.platform_total_retained,
    station_payout: entry.station_payout,
    station_subtotal: entry.station_subtotal,
    station_tax_amount: entry.station_tax_amount,
    station_total_transferred: entry.station_total_transferred,
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
    station_service_total: entry.station_service_total,
    platform_service_fee: entry.platform_service_fee,
    taxable_subtotal: entry.taxable_subtotal,
    tps_amount: entry.tps_amount,
    tvq_amount: entry.tvq_amount,
    client_total: entry.client_total,
    commission_rate: entry.commission_rate,
    commission_amount: entry.commission_amount,
    platform_subtotal: entry.platform_subtotal,
    platform_tax_amount: entry.platform_tax_amount,
    platform_total_retained: entry.platform_total_retained,
    station_payout: entry.station_payout,
    station_subtotal: entry.station_subtotal,
    station_tax_amount: entry.station_tax_amount,
    station_total_transferred: entry.station_total_transferred,
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
    delay_request: entry.delay_request,
  };
}
