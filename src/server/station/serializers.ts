/**
 * API response serializers for station-related entities.
 */
import type { VehicleFormat } from './format-repository';

export type SerializedFormat = {
  id: string;
  label: string;
  price: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

/** Serialize a vehicle format for API JSON response. */
export function serializeFormat(
  format: VehicleFormat
): SerializedFormat {
  return {
    id: format.id,
    label: format.label,
    price: format.price,
    is_active: format.is_active,
    created_at: format.created_at,
    updated_at: format.updated_at,
  };
}
