export type ServiceCategory = 'hand_wash' | 'automatic' | 'self_service';
export type ServiceType = 'exterior' | 'interior' | 'complete';

export interface VehicleFormat {
  id: string;
  label: string;
  price: string;
  is_active: boolean;
}

export interface ServiceVehicleEntry {
  vehicle_format_id: string;
  vehicle_label: string;
  price: string;
  duration_min: number;
  staff_required: number;
  is_active: boolean;
}

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  service_type: ServiceType;
  description: string;
  is_active: boolean;
  vehicle_entries: ServiceVehicleEntry[];
}
