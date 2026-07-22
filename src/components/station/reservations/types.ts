export type EntryStatus =
  | 'pending_payment'
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'late';

export interface ReservationEntry {
  id: string;
  user_id: string;
  entry_type: 'reservation' | 'queue';
  time_slot_id: string | null;
  station_id: string;
  vehicle_format_id: string | null;
  status: EntryStatus;
  queue_position: number | null;
  amount_paid: string | null;
  /* Financial snapshot persisted by the backend on paid entries. Decimal
   * strings; null on legacy/unpaid rows. Rendered on completed entries. */
  station_service_total?: string | null;
  platform_service_fee?: string | null;
  tps_amount?: string | null;
  tvq_amount?: string | null;
  client_total?: string | null;
  commission_rate?: string | null;
  commission_amount?: string | null;
  station_tax_amount?: string | null;
  /** True amount that will be transferred to the station. Reference net figure. */
  station_total_transferred?: string | null;
  /** Legacy payout. Prefer station_total_transferred as the reference net amount. */
  station_payout?: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  user?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  /* Denormalised by the rich-station serializer so the merchant card can show
   * "what was booked" without an extra fetch. service.name is the merchant
   * label (Lavage Premium…) — preferred over the bare vehicle format. */
  vehicle_format?: { id: string; label: string } | null;
  service?: { id: string; name: string; category: string } | null;
  slot_start_time?: string | null;
  slot_end_time?: string | null;
  /* Walk-in identity. Filled only when the merchant added the client
   * manually with an email that does not match a registered account. */
  walk_in_client_email?: string | null;
  walk_in_client_name?: string | null;
  is_walk_in?: boolean;
  /** 6-char code the client shows the merchant to confirm identity before start. */
  ticket_code?: string | null;
}

export type StatusTab = 'all' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'late';
