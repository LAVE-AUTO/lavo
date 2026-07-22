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
import {
  findWashTypeByCode,
  findServiceTypeByCodeAndCategory,
} from './service-category-repository';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ===== CATEGORY / TYPE RESOLUTION =====

/**
 * Resolve a category code (e.g. "hand_wash") to its wash_types row.
 * Throws ValidationError if the code is unknown or inactive.
 */
async function resolveCategory(categoryCode: string) {
  const category = await findWashTypeByCode(categoryCode);
  if (!category) throw new ValidationError(`Unknown service category: ${categoryCode}`);
  return category;
}

/**
 * Resolve a service_type code against the given category's service_types.
 * Categories without any service_types (automatic, self_service) resolve to
 * null — service_type stays a legacy string with no relational type row.
 */
async function resolveServiceType(categoryId: string, typeCode: string) {
  const type = await findServiceTypeByCodeAndCategory(categoryId, typeCode);
  return type ?? null;
}

/**
 * Filter extra IDs to keep only those compatible with the given service
 * category — an extra is compatible when it belongs to the same category.
 */
async function filterCompatibleExtras(
  stationId: string,
  categoryId: string,
  proposedExtraIds: string[]
): Promise<string[]> {
  if (proposedExtraIds.length === 0) return [];

  // Load all extras for the station so we can validate ownership and category
  const stationExtras = await findExtrasByStationId(stationId);
  const stationExtraMap = new Map(stationExtras.map((e) => [e.id, e]));

  return proposedExtraIds.filter((id) => {
    const extra = stationExtraMap.get(id);
    if (!extra) return false; // extra doesn't belong to this station
    return extra.category_id === categoryId;
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

  const category = await resolveCategory(dto.category);
  const type = await resolveServiceType(category.id, dto.service_type);

  const service = await repoCreateService(station.id, {
    name: dto.name,
    category: dto.category,
    service_type: dto.service_type,
    category_id: category.id,
    type_id: type?.id ?? null,
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
    category.id,
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

  // Resolve category/type when changing, otherwise fall back to the service's current values.
  let effectiveCategoryId = service.category_id;
  if (dto.category !== undefined) {
    const category = await resolveCategory(dto.category);
    effectiveCategoryId = category.id;
  }
  if (!effectiveCategoryId) throw new ValidationError('Service has no resolved category');

  let effectiveTypeId: string | null = service.type_id;
  if (dto.category !== undefined || dto.service_type !== undefined) {
    const typeCode = dto.service_type ?? service.service_type;
    const type = await resolveServiceType(effectiveCategoryId, typeCode);
    effectiveTypeId = type?.id ?? null;
  }

  // Update base fields
  const updateData: Parameters<typeof repoUpdateService>[1] = {};
  if (dto.name !== undefined) updateData.name = dto.name;
  if (dto.category !== undefined) {
    updateData.category = dto.category;
    updateData.category_id = effectiveCategoryId;
  }
  if (dto.service_type !== undefined) updateData.service_type = dto.service_type;
  if (dto.category !== undefined || dto.service_type !== undefined) {
    updateData.type_id = effectiveTypeId;
  }
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
    const validatedExtraIds = await filterCompatibleExtras(
      station.id,
      effectiveCategoryId,
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

export type CreateExtraDto = Omit<CreateExtraData, 'scope' | 'category_id'> & { category: string };
export type UpdateExtraDto = Omit<UpdateExtraData, 'scope' | 'category_id'> & { category?: string };

export async function createExtraWithAuth(userId: string, dto: CreateExtraDto) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');
  const { category, ...rest } = dto;
  const categoryRow = await resolveCategory(category);
  return repoCreateExtra(station.id, {
    ...rest,
    scope: 'both',
    category_id: categoryRow.id,
  });
}

export async function updateExtraWithAuth(userId: string, extraId: string, dto: UpdateExtraDto) {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const extra = await findExtraByIdAndStation(extraId, station.id);
  if (!extra) throw new NotFoundError('Extra not found');

  const { category, ...rest } = dto;
  const updateData: UpdateExtraData = { ...rest };
  if (category !== undefined) {
    const categoryRow = await resolveCategory(category);
    updateData.category_id = categoryRow.id;
  }

  return repoUpdateExtra(extraId, updateData);
}

export async function deleteExtraWithAuth(userId: string, extraId: string): Promise<void> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const extra = await findExtraByIdAndStation(extraId, station.id);
  if (!extra) throw new NotFoundError('Extra not found');

  await deleteExtraById(extraId);
}
