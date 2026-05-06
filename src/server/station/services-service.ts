/**
 * Business logic for station services and extras.
 */
import { findStationByUserId } from './station-repository';
import {
  findServicesByStationId,
  findServiceByIdAndStation,
  createService as repoCreateService,
  updateService as repoUpdateService,
  deleteServiceById,
  findServiceVehicleEntries,
  createServiceVehicleEntry as repoCreateServiceVehicleEntry,
  deleteServiceVehicleEntry,
  findExtrasByStationId,
  findExtraByIdAndStation,
  createExtra as repoCreateExtra,
  updateExtra as repoUpdateExtra,
  deleteExtraById,
  addServiceExtraCompatibility,
  removeServiceExtraCompatibility,
  findCompatibleExtrasForService,
  type CreateServiceData,
  type UpdateServiceData,
  type CreateServiceVehicleEntryData,
  type CreateExtraData,
  type UpdateExtraData,
  type StationService,
  type StationExtra,
} from './service-repository';
import { NotFoundError, ConflictError } from '@/lib/errors';

// ===== SERVICES (Packages) =====

/**
 * Get all services for the authenticated station
 */
export async function getServicesByStationUser(userId: string) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');
  return findServicesByStationId(station.id);
}

/**
 * Create a new service with vehicle entries and compatible extras
 */
export async function createServiceWithEntries(
  userId: string,
  dto: {
    name: string;
    category: string;
    service_type: string;
    description?: string;
    is_active?: boolean;
    is_popular?: boolean;
    vehicle_entries?: Array<{
      vehicle_format_id: string;
      price: number | string;
      duration_min?: number;
      staff_required?: number;
    }>;
    compatible_extra_ids?: string[];
  }
) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  // Create service
  const service = await repoCreateService(station.id, {
    name: dto.name,
    category: dto.category,
    service_type: dto.service_type,
    description: dto.description,
    is_active: dto.is_active ?? true,
    is_popular: dto.is_popular ?? false,
  });

  // Add vehicle entries
  if (dto.vehicle_entries && dto.vehicle_entries.length > 0) {
    for (const entry of dto.vehicle_entries) {
      await repoCreateServiceVehicleEntry({
        service_id: service.id,
        vehicle_format_id: entry.vehicle_format_id,
        price: entry.price,
        duration_min: entry.duration_min,
        staff_required: entry.staff_required,
      });
    }
  }

  // Add compatible extras
  if (dto.compatible_extra_ids && dto.compatible_extra_ids.length > 0) {
    for (const extraId of dto.compatible_extra_ids) {
      await addServiceExtraCompatibility(service.id, extraId);
    }
  }

  return service;
}

/**
 * Update a service with full capability (name, category, entries, extras)
 */
export async function updateServiceWithEntries(
  userId: string,
  serviceId: string,
  dto: {
    name?: string;
    category?: string;
    service_type?: string;
    description?: string;
    is_active?: boolean;
    is_popular?: boolean;
    vehicle_entries?: Array<{
      vehicle_format_id: string;
      price: number | string;
      duration_min?: number;
      staff_required?: number;
    }>;
    compatible_extra_ids?: string[];
  }
) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const service = await findServiceByIdAndStation(serviceId, station.id);
  if (!service) throw new NotFoundError('Service not found');

  // Update basic fields
  const updateData: UpdateServiceData = {};
  if (dto.name !== undefined) updateData.name = dto.name;
  if (dto.category !== undefined) updateData.category = dto.category;
  if (dto.service_type !== undefined) updateData.service_type = dto.service_type;
  if (dto.description !== undefined) updateData.description = dto.description;
  if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
  if (dto.is_popular !== undefined) updateData.is_popular = dto.is_popular;

  const updated = await repoUpdateService(serviceId, updateData);

  // Update vehicle entries if provided
  if (dto.vehicle_entries) {
    // Remove existing entries
    const existing = await findServiceVehicleEntries(serviceId);
    for (const entry of existing) {
      await deleteServiceVehicleEntry(entry.id);
    }
    // Add new entries
    for (const entry of dto.vehicle_entries) {
      await repoCreateServiceVehicleEntry({
        service_id: serviceId,
        vehicle_format_id: entry.vehicle_format_id,
        price: entry.price,
        duration_min: entry.duration_min,
        staff_required: entry.staff_required,
      });
    }
  }

  // Update compatible extras if provided
  if (dto.compatible_extra_ids) {
    const current = await findCompatibleExtrasForService(serviceId);
    // Remove extras not in new list
    for (const extraId of current) {
      if (!dto.compatible_extra_ids.includes(extraId)) {
        await removeServiceExtraCompatibility(serviceId, extraId);
      }
    }
    // Add extras not in current list
    for (const extraId of dto.compatible_extra_ids) {
      if (!current.includes(extraId)) {
        await addServiceExtraCompatibility(serviceId, extraId);
      }
    }
  }

  return updated;
}

/**
 * Delete a service
 */
export async function deleteServiceWithAuth(userId: string, serviceId: string) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const service = await findServiceByIdAndStation(serviceId, station.id);
  if (!service) throw new NotFoundError('Service not found');

  await deleteServiceById(serviceId);
}

// ===== EXTRAS (Add-ons) =====

/**
 * Get all extras for the authenticated station
 */
export async function getExtrasByStationUser(userId: string) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');
  return findExtrasByStationId(station.id);
}

/**
 * Create a new extra
 */
export async function createExtraWithAuth(
  userId: string,
  dto: CreateExtraData
) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');
  return repoCreateExtra(station.id, dto);
}

/**
 * Update an extra
 */
export async function updateExtraWithAuth(
  userId: string,
  extraId: string,
  dto: UpdateExtraData
) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const extra = await findExtraByIdAndStation(extraId, station.id);
  if (!extra) throw new NotFoundError('Extra not found');

  return repoUpdateExtra(extraId, dto);
}

/**
 * Delete an extra
 */
export async function deleteExtraWithAuth(userId: string, extraId: string) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const extra = await findExtraByIdAndStation(extraId, station.id);
  if (!extra) throw new NotFoundError('Extra not found');

  await deleteExtraById(extraId);
}
