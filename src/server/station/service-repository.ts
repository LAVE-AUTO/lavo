/**
 * Data access for station services and their pricing configurations.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  stationServices,
  serviceVehicleEntries,
  stationExtras,
  extraVehicleEntries,
  serviceExtraCompatibility,
  type StationService,
  type ServiceVehicleEntry,
  type StationExtra,
} from '@/lib/db/schema';

// ===== SERVICE CRUD =====

export type CreateServiceData = {
  name: string;
  category: string;
  service_type: string;
  description?: string;
  is_active?: boolean;
  is_popular?: boolean;
};

export type UpdateServiceData = Partial<{
  name: string;
  category: string;
  service_type: string;
  description: string;
  is_active: boolean;
  is_popular: boolean;
}>;

/**
 * Get all services for a station
 */
export async function findServicesByStationId(stationId: string): Promise<StationService[]> {
  return db.query.stationServices.findMany({
    where: eq(stationServices.station_id, stationId),
    orderBy: (s, { asc }) => [asc(s.created_at)],
  });
}

/**
 * Get one service by id and verify it belongs to the station
 */
export async function findServiceByIdAndStation(
  serviceId: string,
  stationId: string
): Promise<StationService | undefined> {
  return db.query.stationServices.findFirst({
    where: and(eq(stationServices.id, serviceId), eq(stationServices.station_id, stationId)),
  });
}

/**
 * Create a new service
 */
export async function createService(
  stationId: string,
  data: CreateServiceData
): Promise<StationService> {
  const [row] = await db
    .insert(stationServices)
    .values({
      station_id: stationId,
      name: data.name,
      category: data.category,
      service_type: data.service_type,
      description: data.description,
      is_active: data.is_active ?? true,
      is_popular: data.is_popular ?? false,
    })
    .returning();
  if (!row) throw new Error('Insert service failed');
  return row;
}

/**
 * Update a service
 */
export async function updateService(id: string, data: UpdateServiceData): Promise<StationService> {
  const payload = { ...data, updated_at: new Date() };
  const [row] = await db
    .update(stationServices)
    .set(payload)
    .where(eq(stationServices.id, id))
    .returning();
  if (!row) throw new Error('Update service failed');
  return row;
}

/**
 * Delete a service (cascades to vehicle entries and compatibility)
 */
export async function deleteServiceById(id: string): Promise<void> {
  await db.delete(stationServices).where(eq(stationServices.id, id));
}

// ===== SERVICE VEHICLE ENTRIES =====

export type CreateServiceVehicleEntryData = {
  service_id: string;
  vehicle_format_id: string;
  price: string | number;
  duration_min?: number;
  staff_required?: number;
  is_active?: boolean;
};

/**
 * Get all vehicle entries for a service
 */
export async function findServiceVehicleEntries(
  serviceId: string
): Promise<ServiceVehicleEntry[]> {
  return db.query.serviceVehicleEntries.findMany({
    where: eq(serviceVehicleEntries.service_id, serviceId),
    orderBy: (sve, { asc }) => [asc(sve.created_at)],
  });
}

/**
 * Create a service-vehicle price entry
 */
export async function createServiceVehicleEntry(
  data: CreateServiceVehicleEntryData
): Promise<ServiceVehicleEntry> {
  const [row] = await db
    .insert(serviceVehicleEntries)
    .values({
      service_id: data.service_id,
      vehicle_format_id: data.vehicle_format_id,
      price: String(data.price),
      duration_min: data.duration_min ?? 45,
      staff_required: data.staff_required ?? 1,
      is_active: data.is_active ?? true,
    })
    .returning();
  if (!row) throw new Error('Insert service vehicle entry failed');
  return row;
}

/**
 * Delete a service-vehicle entry
 */
export async function deleteServiceVehicleEntry(entryId: string): Promise<void> {
  await db.delete(serviceVehicleEntries).where(eq(serviceVehicleEntries.id, entryId));
}

// ===== EXTRAS CRUD =====

export type CreateExtraData = {
  label: string;
  scope: string; // 'exterior', 'interior', 'both'
  price: string | number;
  duration_min?: number;
  staff_required?: number;
  is_active?: boolean;
};

export type UpdateExtraData = Partial<{
  label: string;
  scope: string;
  price: string | number;
  duration_min: number;
  staff_required: number;
  is_active: boolean;
}>;

/**
 * Get all extras for a station
 */
export async function findExtrasByStationId(stationId: string): Promise<StationExtra[]> {
  return db.query.stationExtras.findMany({
    where: eq(stationExtras.station_id, stationId),
    orderBy: (e, { asc }) => [asc(e.created_at)],
  });
}

/**
 * Get one extra by id and verify it belongs to the station
 */
export async function findExtraByIdAndStation(
  extraId: string,
  stationId: string
): Promise<StationExtra | undefined> {
  return db.query.stationExtras.findFirst({
    where: and(eq(stationExtras.id, extraId), eq(stationExtras.station_id, stationId)),
  });
}

/**
 * Create a new extra
 */
export async function createExtra(
  stationId: string,
  data: CreateExtraData
): Promise<StationExtra> {
  const [row] = await db
    .insert(stationExtras)
    .values({
      station_id: stationId,
      label: data.label,
      scope: data.scope,
      price: String(data.price),
      duration_min: data.duration_min ?? 10,
      staff_required: data.staff_required ?? 0,
      is_active: data.is_active ?? true,
    })
    .returning();
  if (!row) throw new Error('Insert extra failed');
  return row;
}

/**
 * Update an extra
 */
export async function updateExtra(id: string, data: UpdateExtraData): Promise<StationExtra> {
  const payload = { ...data, updated_at: new Date() };
  if (payload.price !== undefined) {
    payload.price = String(payload.price);
  }
  const [row] = await db
    .update(stationExtras)
    .set(payload)
    .where(eq(stationExtras.id, id))
    .returning();
  if (!row) throw new Error('Update extra failed');
  return row;
}

/**
 * Delete an extra (cascades to vehicle entries and compatibility)
 */
export async function deleteExtraById(id: string): Promise<void> {
  await db.delete(stationExtras).where(eq(stationExtras.id, id));
}

// ===== SERVICE-EXTRA COMPATIBILITY =====

/**
 * Add compatibility between a service and an extra
 */
export async function addServiceExtraCompatibility(
  serviceId: string,
  extraId: string
): Promise<void> {
  await db.insert(serviceExtraCompatibility).values({ service_id: serviceId, extra_id: extraId });
}

/**
 * Remove compatibility between a service and an extra
 */
export async function removeServiceExtraCompatibility(
  serviceId: string,
  extraId: string
): Promise<void> {
  await db
    .delete(serviceExtraCompatibility)
    .where(
      and(
        eq(serviceExtraCompatibility.service_id, serviceId),
        eq(serviceExtraCompatibility.extra_id, extraId)
      )
    );
}

/**
 * Get all compatible extras for a service
 */
export async function findCompatibleExtrasForService(serviceId: string): Promise<string[]> {
  const rows = await db.query.serviceExtraCompatibility.findMany({
    where: eq(serviceExtraCompatibility.service_id, serviceId),
    columns: { extra_id: true },
  });
  return rows.map((r) => r.extra_id);
}
