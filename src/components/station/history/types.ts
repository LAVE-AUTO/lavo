export interface StationHistoryEntry {
  id: string;
  date: string;
  entry_type: 'reservation' | 'queue';
  status: string;
  client: { first_name: string; last_name: string } | null;
  vehicle_format_label: string | null;
  service_name: string | null;
  service_category: string | null;
  amount_paid: string;
  /** Legacy payout. Prefer station_total_transferred as the reference net amount. */
  station_payout: string | null;
  commission_rate: string;
  commission_amount: string | null;
  /* Financial snapshot (decimal strings, nullable for legacy entries). */
  station_service_total: string | null;
  platform_service_fee: string | null;
  taxable_subtotal: string | null;
  tps_amount: string | null;
  tvq_amount: string | null;
  client_total: string | null;
  platform_subtotal: string | null;
  platform_tax_amount: string | null;
  platform_total_retained: string | null;
  station_subtotal: string | null;
  station_tax_amount: string | null;
  /** True amount transferred to the station. Reference net figure for the detail view. */
  station_total_transferred: string | null;
  tip_amount: string | null;
  penalty_amount: string | null;
  reservation_ref: string | null;
}

export interface StationHistoryMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export type StatusFilter = 'all' | 'completed' | 'cancelled';
