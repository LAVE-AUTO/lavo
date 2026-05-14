export interface KpiData {
  revenue: number | null;
  clients: number | null;
  lateFees: number | null;
  occupancy: number | null;
}

export interface ReservationItem {
  id: string;
  clientName: string;
  vehicleFormat: string | null;
  status: string;
  slotStart: string | null;
  slotEnd: string | null;
  amountPaid: number | null;
}
