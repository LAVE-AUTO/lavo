export interface StationHistoryEntry {
  id: string;
  date: string;
  entry_type: 'reservation' | 'queue';
  status: string;
  client: { first_name: string; last_name: string } | null;
  vehicle_format_label: string | null;
  amount_paid: string;
  station_payout: string | null;
  commission_rate: string;
  commission_amount: string | null;
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

export type PeriodKey = 'all' | 'week' | 'month' | '3months' | 'year';
export type StatusFilter = 'all' | 'completed' | 'cancelled';
