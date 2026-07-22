/** A service type belonging to a category (only "hand_wash" has any today). */
export interface ServiceCategoryType {
  id: string;
  code: string;
  label: string;
}

/** A service category, fetched from /service-categories — no more hardcoded enum. */
export interface ServiceCategoryOption {
  id: string;
  code: string;
  label: string;
  types: ServiceCategoryType[];
}

export interface VehicleFormat {
  id: string;
  label: string;
  price: string;
  is_active: boolean;
}

export interface ServiceVehicleEntry {
  /**
   * Backend row id from service_vehicle_entries. Optional because the
   * inline editor (ServiceVehicleRows) builds entries from VehicleFormat
   * objects before they have a DB row. API-sourced entries always carry
   * a real id and should be keyed on it (vehicle_format_id can be empty
   * '' on the catalogue placeholders for automatic / self_service services).
   */
  id?: string;
  vehicle_format_id: string;
  vehicle_label: string;
  /**
   * Per-package description (automatic services), persisted on
   * service_vehicle_entries.
   */
  description?: string;
  price: string;
  duration_min: number;
  staff_required: number;
  is_active: boolean;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  service_type: string;
  description: string;
  is_active: boolean;
  is_popular?: boolean;
  vehicle_entries: ServiceVehicleEntry[];
  compatible_extras?: { id: string; name: string }[];
}
