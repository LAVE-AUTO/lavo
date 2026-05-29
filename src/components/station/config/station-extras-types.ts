/** Per-vehicle pricing entry, mirrors ServiceVehicleEntry shape from formats/types.ts. */
export interface ExtraVehicleEntry {
  /** Backend row id from extra_vehicle_entries — used as a stable React key. */
  id?: string;
  vehicle_format_id: string;
  vehicle_label: string;
  price: string;
  duration_min: number;
}

export interface StationExtra {
  id: string;
  label: string;
  description: string;
  price: string;
  is_active: boolean;
  scope?: 'exterior' | 'interior' | 'both';
  duration_min?: number;
  staff_required?: number;
  /** Optional per-vehicle pricing. When absent, the flat `price` applies to all formats. */
  vehicle_entries?: ExtraVehicleEntry[];
}

export interface StationExtras {
  exterior: StationExtra[];
  interior: StationExtra[];
  both: StationExtra[];
}
