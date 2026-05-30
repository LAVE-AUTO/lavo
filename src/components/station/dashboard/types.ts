export interface KpiData {
  revenue: number | null;
  clients: number | null;
  lateFees: number | null;
  occupancy: number | null;
}

export interface ReservationItem {
  id: string;
  clientName: string;
  /** Merchant-set service name (station_services.name) when available. */
  serviceName: string | null;
  /** Vehicle format label kept as a secondary descriptor / fallback. */
  vehicleFormat: string | null;
  status: string;
  slotStart: string | null;
  slotEnd: string | null;
  amountPaid: number | null;
}
