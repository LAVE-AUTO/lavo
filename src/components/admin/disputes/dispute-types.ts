export type DisputeStatus = 'open' | 'refunded' | 'resolved' | 'rejected';

export interface DisputeStation {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface DisputeClient {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
}

export interface DisputeStationDetail extends DisputeStation {
  contact_email: string | null;
  contact_phone: string | null;
}

export interface DisputeReservationDetail {
  id: string;
  amount_paid: string;
  ticket_code: string | null;
  entry_type: string;
  status: string;
  service_start: string | null;
  service_end: string | null;
  vehicle_format_label: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface DisputeListItem {
  id: string;
  reason: string;
  description: string | null;
  status: DisputeStatus;
  requested_amount: string | null;
  refunded_amount: string | null;
  client_id: string;
  station_id: string;
  reservation_id: string;
  created_at: string;
  updated_at: string;
  station: DisputeStation | null;
}

export interface DisputeDetail extends Omit<DisputeListItem, 'station'> {
  closed_by: string | null;
  closed_reason: string | null;
  stripe_refund_id: string | null;
  client: DisputeClient | null;
  station: DisputeStationDetail | null;
  reservation: DisputeReservationDetail | null;
}

export function clientDisplayName(client: DisputeClient | null): string {
  if (!client) return '';
  const full = [client.first_name, client.last_name].filter(Boolean).join(' ');
  return full || client.email;
}

export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}
