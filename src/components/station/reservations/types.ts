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
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  user?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export type StatusTab = 'all' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'late';
