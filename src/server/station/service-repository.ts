/**
 * Data access for station services and their pricing configurations.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  stationServices,
  serviceVehicleEntries,
  stationExtras,
  serviceExtraCompatibility,
  type StationService,
  type ServiceVehicleEntry,
  type StationExtra,
} from '@/lib/db/schema';

// ===== TYPES =====

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

export type CreateServiceVehicleEntryData = {
  service_id: string;
  vehicle_format_id?: string | null;
  vehicle_label: string;
  price: string | number;
  duration_min?: number;
  staff_required?: number;
  is_active?: boolean;
};

export type CreateExtraData = {
  label: string;
  scope: string;
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

// Enriched service as returned to the frontend
export type EnrichedService = StationService & {
  vehicle_entries: (ServiceVehicleEntry & { vehicle_label: string })[];
  compatible_extras: { id: string; label: string }[];
};

// ===== SERVICES =====

export async function findServicesByStationId(stationId: string): Promise<StationService[]> {
  return db.query.stationServices.findMany({
    where: and(eq(stationServices.station_id, stationId), isNull(stationServices.deleted_at)),
    orderBy: (s, { asc }) => [asc(s.created_at)],
  });
}

export async function findServiceByIdAndStation(
  serviceId: string,
  stationId: string
): Promise<StationService | undefined> {
  return db.query.stationServices.findFirst({
    where: and(
      eq(stationServices.id, serviceId),
      eq(stationServices.station_id, stationId),
      isNull(stationServices.deleted_at)
    ),
  });
}

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

export async function updateService(id: string, data: UpdateServiceData): Promise<StationService> {
  const [row] = await db
    .update(stationServices)
    .set({ ...data, updated_at: new Date() })
    .where(eq(stationServices.id, id))
    .returning();
  if (!row) throw new Error('Update service failed');
  return row;
}

export async function softDeleteServiceById(id: string): Promise<void> {
  await db
    .update(stationServices)
    .set({ deleted_at: new Date() })
    .where(eq(stationServices.id, id));
}

// ===== SERVICE VEHICLE ENTRIES =====

export async function findServiceVehicleEntries(serviceId: string): Promise<ServiceVehicleEntry[]> {
  return db.query.serviceVehicleEntries.findMany({
    where: eq(serviceVehicleEntries.service_id, serviceId),
    orderBy: (e, { asc }) => [asc(e.created_at)],
  });
}

export async function createServiceVehicleEntry(
  data: CreateServiceVehicleEntryData
): Promise<ServiceVehicleEntry> {
  const [row] = await db
    .insert(serviceVehicleEntries)
    .values({
      service_id: data.service_id,
      vehicle_format_id: data.vehicle_format_id ?? null,
      vehicle_label: data.vehicle_label,
      price: String(data.price),
      duration_min: data.duration_min ?? 45,
      staff_required: data.staff_required ?? 1,
      is_active: data.is_active ?? true,
    })
    .returning();
  if (!row) throw new Error('Insert service vehicle entry failed');
  return row;
}

export async function deleteServiceVehicleEntry(entryId: string): Promise<void> {
  await db.delete(serviceVehicleEntries).where(eq(serviceVehicleEntries.id, entryId));
}

export async function deleteServiceVehicleEntriesByServiceId(serviceId: string): Promise<void> {
  await db.delete(serviceVehicleEntries).where(eq(serviceVehicleEntries.service_id, serviceId));
}

// ===== EXTRAS =====

export async function findExtrasByStationId(stationId: string): Promise<StationExtra[]> {
  return db.query.stationExtras.findMany({
    where: eq(stationExtras.station_id, stationId),
    orderBy: (e, { asc }) => [asc(e.created_at)],
  });
}

export async function findExtraByIdAndStation(
  extraId: string,
  stationId: string
): Promise<StationExtra | undefined> {
  return db.query.stationExtras.findFirst({
    where: and(eq(stationExtras.id, extraId), eq(stationExtras.station_id, stationId)),
  });
}

export async function createExtra(stationId: string, data: CreateExtraData): Promise<StationExtra> {
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

export async function updateExtra(id: string, data: UpdateExtraData): Promise<StationExtra> {
  const payload: Record<string, unknown> = { ...data, updated_at: new Date() };
  if (payload.price !== undefined) payload.price = String(payload.price);
  const [row] = await db
    .update(stationExtras)
    .set(payload)
    .where(eq(stationExtras.id, id))
    .returning();
  if (!row) throw new Error('Update extra failed');
  return row;
}

export async function deleteExtraById(id: string): Promise<void> {
  await db.delete(stationExtras).where(eq(stationExtras.id, id));
}

// ===== SERVICE-EXTRA COMPATIBILITY =====

export async function addServiceExtraCompatibility(serviceId: string, extraId: string): Promise<void> {
  await db
    .insert(serviceExtraCompatibility)
    .values({ service_id: serviceId, extra_id: extraId })
    .onConflictDoNothing();
}

export async function removeServiceExtraCompatibility(serviceId: string, extraId: string): Promise<void> {
  await db
    .delete(serviceExtraCompatibility)
    .where(
      and(
        eq(serviceExtraCompatibility.service_id, serviceId),
        eq(serviceExtraCompatibility.extra_id, extraId)
      )
    );
}

export async function findCompatibleExtrasForService(serviceId: string): Promise<string[]> {
  const rows = await db.query.serviceExtraCompatibility.findMany({
    where: eq(serviceExtraCompatibility.service_id, serviceId),
    columns: { extra_id: true },
  });
  return rows.map((r) => r.extra_id);
}

// ===== ENRICHED FETCH =====

// ===== PUBLIC BOOKING HELPERS =====

export type PublicServiceEntry = {
  id: string;
  vehicle_format_id: string | null;
  vehicle_label: string;
  price: string;
  duration_min: number;
};

export type PublicServiceExtra = {
  id: string;
  label: string;
  scope: string;
  price: string;
  duration_min: number;
};

export type PublicStationService = {
  id: string;
  name: string;
  category: string;
  service_type: string;
  description: string | null;
  is_popular: boolean;
  vehicle_entries: PublicServiceEntry[];
  extras: PublicServiceExtra[];
};

/**
 * Find the service_vehicle_entry for a booking.
 * For hand_wash: vehicleFormatId provided → match by service + format.
 * For other categories: vehicleFormatId null → match first active entry for service (vehicle_format_id IS NULL).
 */
export async function findServiceVehicleEntryForBooking(
  serviceId: string,
  vehicleFormatId?: string | null,
): Promise<ServiceVehicleEntry | undefined> {
  if (vehicleFormatId) {
    return db.query.serviceVehicleEntries.findFirst({
      where: and(
        eq(serviceVehicleEntries.service_id, serviceId),
        eq(serviceVehicleEntries.vehicle_format_id, vehicleFormatId),
        eq(serviceVehicleEntries.is_active, true),
      ),
    });
  }
  return db.query.serviceVehicleEntries.findFirst({
    where: and(
      eq(serviceVehicleEntries.service_id, serviceId),
      isNull(serviceVehicleEntries.vehicle_format_id),
      eq(serviceVehicleEntries.is_active, true),
    ),
  });
}

/**
 * Returns all active services for a station with their vehicle entries and compatible extras.
 * Used for the public station detail endpoint (client booking flow).
 */
export async function findPublicServicesForStation(stationId: string): Promise<PublicStationService[]> {
  const services = await db.query.stationServices.findMany({
    where: and(
      eq(stationServices.station_id, stationId),
      eq(stationServices.is_active, true),
      isNull(stationServices.deleted_at),
    ),
    orderBy: (s, { asc }) => [asc(s.created_at)],
  });

  const result: PublicStationService[] = [];

  for (const service of services) {
    const entries = await db.query.serviceVehicleEntries.findMany({
      where: and(
        eq(serviceVehicleEntries.service_id, service.id),
        eq(serviceVehicleEntries.is_active, true),
      ),
      orderBy: (e, { asc }) => [asc(e.created_at)],
    });

    const compatRows = await db.query.serviceExtraCompatibility.findMany({
      where: eq(serviceExtraCompatibility.service_id, service.id),
    });

    const extras: PublicServiceExtra[] = [];
    for (const compat of compatRows) {
      const extra = await db.query.stationExtras.findFirst({
        where: and(
          eq(stationExtras.id, compat.extra_id),
          eq(stationExtras.is_active, true),
        ),
      });
      if (extra) {
        extras.push({
          id: extra.id,
          label: extra.label,
          scope: extra.scope,
          price: extra.price,
          duration_min: extra.duration_min,
        });
      }
    }

    result.push({
      id: service.id,
      name: service.name,
      category: service.category,
      service_type: service.service_type,
      description: service.description,
      is_popular: service.is_popular,
      vehicle_entries: entries.map((e) => ({
        id: e.id,
        vehicle_format_id: e.vehicle_format_id,
        vehicle_label: e.vehicle_label,
        price: e.price,
        duration_min: e.duration_min,
      })),
      extras,
    });
  }

  return result;
}

/**
 * Fetch a single service with its vehicle entries and compatible extras labels.
 * Used after create/update to return a complete object to the client.
 */
export async function findEnrichedService(serviceId: string): Promise<EnrichedService | null> {
  const service = await db.query.stationServices.findFirst({
    where: and(eq(stationServices.id, serviceId), isNull(stationServices.deleted_at)),
  });
  if (!service) return null;

  const entries = await db.query.serviceVehicleEntries.findMany({
    where: eq(serviceVehicleEntries.service_id, serviceId),
    orderBy: (e, { asc }) => [asc(e.created_at)],
  });

  const extraRows = await db.query.serviceExtraCompatibility.findMany({
    where: eq(serviceExtraCompatibility.service_id, serviceId),
    columns: { extra_id: true },
  });

  const compatibleExtras: { id: string; label: string }[] = [];
  for (const row of extraRows) {
    const extra = await db.query.stationExtras.findFirst({
      where: eq(stationExtras.id, row.extra_id),
      columns: { id: true, label: true },
    });
    if (extra) compatibleExtras.push({ id: extra.id, label: extra.label });
  }

  return {
    ...service,
    vehicle_entries: entries.map((e) => ({ ...e, vehicle_label: e.vehicle_label ?? '' })),
    compatible_extras: compatibleExtras,
  };
}

/**
 * Fetch all services for a station, each enriched with vehicle entries and
 * compatible extras labels.
 */
export async function findEnrichedServicesByStationId(stationId: string): Promise<EnrichedService[]> {
  const services = await db.query.stationServices.findMany({
    where: eq(stationServices.station_id, stationId),
    orderBy: (s, { asc }) => [asc(s.created_at)],
  });

  const enriched: EnrichedService[] = [];
  for (const service of services) {
    const result = await findEnrichedService(service.id);
    if (result) enriched.push(result);
  }
  return enriched;
}
