/**
 * Business logic for station services and extras.
 */
import { findStationByUserId } from './station-repository';
import {
  findEnrichedServicesByStationId,
  findEnrichedService,
  findServiceByIdAndStation,
  createService as repoCreateService,
  updateService as repoUpdateService,
  softDeleteServiceById,
  findServiceVehicleEntries,
  deleteServiceVehicleEntriesByServiceId,
  createServiceVehicleEntry as repoCreateServiceVehicleEntry,
  findExtrasByStationId,
  findExtraByIdAndStation,
  createExtra as repoCreateExtra,
  updateExtra as repoUpdateExtra,
  deleteExtraById,
  addServiceExtraCompatibility,
  removeServiceExtraCompatibility,
  findCompatibleExtrasForService,
  type CreateExtraData,
  type UpdateExtraData,
  type EnrichedService,
} from './service-repository';
import { NotFoundError } from '@/lib/errors';

// ===== CATEGORY RULES (extensible per-category strategy) =====

/**
 * Filter extra IDs to keep only those compatible with the given service
 * category and service type. Unrecognised categories pass all extras through.
 *
 * Add a new branch here when implementing a new category.
 */
async function filterCompatibleExtras(
  stationId: string,
  category: string,
  serviceType: string,
  proposedExtraIds: string[]
): Promise<string[]> {
  if (proposedExtraIds.length === 0) return [];

  // Load all extras for the station so we can validate ownership and scope
  const stationExtras = await findExtrasByStationId(stationId);
  const stationExtraMap = new Map(stationExtras.map((e) => [e.id, e]));

  return proposedExtraIds.filter((id) => {
    const extra = stationExtraMap.get(id);
    if (!extra) return false; // extra doesn't belong to this station

    if (category === 'hand_wash') {
      // Scope rule: exterior service → exterior+both extras
      //             interior service → interior+both extras
      //             complete service → all extras
      if (serviceType === 'exterior') return extra.scope === 'exterior' || extra.scope === 'both';
      if (serviceType === 'interior') return extra.scope === 'interior' || extra.scope === 'both';
      if (serviceType === 'complete') return true;
    }

    // Other categories: no extras (automatic, self_service)
    return false;
  });
}

// ===== SERVICES =====

export async function getServicesByStationUser(userId: string): Promise<EnrichedService[]> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');
  return findEnrichedServicesByStationId(station.id);
}

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
      vehicle_format_id?: string | null;
      vehicle_label: string;
      description?: string | null;
      price: number | string;
      duration_min?: number;
      staff_required?: number;
      is_active?: boolean;
    }>;
    compatible_extra_ids?: string[];
  }
): Promise<EnrichedService> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const service = await repoCreateService(station.id, {
    name: dto.name,
    category: dto.category,
    service_type: dto.service_type,
    description: dto.description,
    is_active: dto.is_active ?? true,
    is_popular: dto.is_popular ?? false,
  });

  if (dto.vehicle_entries && dto.vehicle_entries.length > 0) {
    for (const entry of dto.vehicle_entries) {
      await repoCreateServiceVehicleEntry({
        service_id: service.id,
        vehicle_format_id: entry.vehicle_format_id ?? null,
        vehicle_label: entry.vehicle_label,
        description: entry.description ?? null,
        price: entry.price,
        duration_min: entry.duration_min,
        staff_required: entry.staff_required,
        is_active: entry.is_active,
      });
    }
  }

  const validatedExtraIds = await filterCompatibleExtras(
    station.id,
    dto.category,
    dto.service_type ?? 'exterior',
    dto.compatible_extra_ids ?? []
  );
  for (const extraId of validatedExtraIds) {
    await addServiceExtraCompatibility(service.id, extraId);
  }

  const enriched = await findEnrichedService(service.id);
  if (!enriched) throw new Error('Failed to fetch created service');
  return enriched;
}

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
      vehicle_format_id?: string | null;
      vehicle_label: string;
      description?: string | null;
      price: number | string;
      duration_min?: number;
      staff_required?: number;
      is_active?: boolean;
    }>;
    compatible_extra_ids?: string[];
  }
): Promise<EnrichedService> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const service = await findServiceByIdAndStation(serviceId, station.id);
  if (!service) throw new NotFoundError('Service not found');

  // Update base fields
  const updateData: Parameters<typeof repoUpdateService>[1] = {};
  if (dto.name !== undefined) updateData.name = dto.name;
  if (dto.category !== undefined) updateData.category = dto.category;
  if (dto.service_type !== undefined) updateData.service_type = dto.service_type;
  if (dto.description !== undefined) updateData.description = dto.description;
  if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
  if (dto.is_popular !== undefined) updateData.is_popular = dto.is_popular;

  await repoUpdateService(serviceId, updateData);

  // Replace vehicle entries when provided
  if (dto.vehicle_entries !== undefined) {
    await deleteServiceVehicleEntriesByServiceId(serviceId);
    for (const entry of dto.vehicle_entries) {
      await repoCreateServiceVehicleEntry({
        service_id: serviceId,
        vehicle_format_id: entry.vehicle_format_id ?? null,
        vehicle_label: entry.vehicle_label,
        description: entry.description ?? null,
        price: entry.price,
        duration_min: entry.duration_min,
        staff_required: entry.staff_required,
        is_active: entry.is_active,
      });
    }
  }

  // Sync compatible extras when provided
  if (dto.compatible_extra_ids !== undefined) {
    const effectiveCategory = dto.category ?? service.category;
    const effectiveType = dto.service_type ?? service.service_type;

    const validatedExtraIds = await filterCompatibleExtras(
      station.id,
      effectiveCategory,
      effectiveType,
      dto.compatible_extra_ids
    );

    const current = await findCompatibleExtrasForService(serviceId);
    for (const extraId of current) {
      if (!validatedExtraIds.includes(extraId)) {
        await removeServiceExtraCompatibility(serviceId, extraId);
      }
    }
    for (const extraId of validatedExtraIds) {
      if (!current.includes(extraId)) {
        await addServiceExtraCompatibility(serviceId, extraId);
      }
    }
  }

  const enriched = await findEnrichedService(serviceId);
  if (!enriched) throw new Error('Failed to fetch updated service');
  return enriched;
}

export async function deleteServiceWithAuth(userId: string, serviceId: string): Promise<void> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const service = await findServiceByIdAndStation(serviceId, station.id);
  if (!service) throw new NotFoundError('Service not found');

  await softDeleteServiceById(serviceId);
}

// ===== EXTRAS =====

export async function getExtrasByStationUser(userId: string) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');
  return findExtrasByStationId(station.id);
}

export async function createExtraWithAuth(userId: string, dto: CreateExtraData) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');
  return repoCreateExtra(station.id, dto);
}

export async function updateExtraWithAuth(userId: string, extraId: string, dto: UpdateExtraData) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const extra = await findExtraByIdAndStation(extraId, station.id);
  if (!extra) throw new NotFoundError('Extra not found');

  return repoUpdateExtra(extraId, dto);
}

export async function deleteExtraWithAuth(userId: string, extraId: string): Promise<void> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const extra = await findExtraByIdAndStation(extraId, station.id);
  if (!extra) throw new NotFoundError('Extra not found');

  await deleteExtraById(extraId);
}
