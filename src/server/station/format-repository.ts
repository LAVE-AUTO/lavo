/**
 * Data access for vehicle_formats. List by station, find by id+station, create, update, delete.
 * Count reservations by format for safe-delete check.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vehicleFormats, reservations } from '@/lib/db/schema';

export type VehicleFormat = typeof vehicleFormats.$inferSelect;
export type VehicleFormatInsert = typeof vehicleFormats.$inferInsert;

export type CreateFormatData = {
  label: string;
  price: string;
  is_active: boolean;
};

export type UpdateFormatData = Partial<{
  label: string;
  price: string;
  is_active: boolean;
}>;

/**
 * Returns all vehicle formats for the given station, ordered by created_at.
 */
export async function findFormatsByStationId(stationId: string): Promise<VehicleFormat[]> {
  return db.query.vehicleFormats.findMany({
    where: eq(vehicleFormats.station_id, stationId),
    orderBy: (vf, { asc }) => [asc(vf.created_at)],
  });
}

/**
 * Returns one format if it exists and belongs to the given station; otherwise undefined.
 */
export async function findFormatByIdAndStation(
  formatId: string,
  stationId: string
): Promise<VehicleFormat | undefined> {
  return db.query.vehicleFormats.findFirst({
    where: and(eq(vehicleFormats.id, formatId), eq(vehicleFormats.station_id, stationId)),
  });
}

/**
 * Inserts a new vehicle format for the station. Returns the created row.
 */
export async function createFormat(
  stationId: string,
  data: CreateFormatData
): Promise<VehicleFormat> {
  const [row] = await db
    .insert(vehicleFormats)
    .values({
      station_id: stationId,
      label: data.label,
      price: data.price,
      is_active: data.is_active,
    })
    .returning();
  if (!row) throw new Error('Insert vehicle format failed');
  return row;
}

/**
 * Updates a format by id. Caller must ensure the format exists and belongs to the station.
 */
export async function updateFormat(id: string, data: UpdateFormatData): Promise<VehicleFormat> {
  const payload: Record<string, unknown> = { ...data, updated_at: new Date() };
  const [row] = await db
    .update(vehicleFormats)
    .set(payload as Partial<VehicleFormat>)
    .where(eq(vehicleFormats.id, id))
    .returning();
  if (!row) throw new Error('Update vehicle format failed');
  return row;
}

/**
 * Returns the number of reservations that reference this vehicle format.
 */
export async function countReservationsByFormatId(formatId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reservations)
    .where(eq(reservations.vehicle_format_id, formatId));
  const raw = result[0]?.count;
  return typeof raw === 'number' ? raw : Number(raw ?? 0);
}

/**
 * Deletes a vehicle format by id. Caller must ensure no reservations reference it.
 */
export async function deleteFormatById(id: string): Promise<void> {
  await db.delete(vehicleFormats).where(eq(vehicleFormats.id, id));
}
