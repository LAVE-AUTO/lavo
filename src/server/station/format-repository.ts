/**
 * Data access for vehicle_formats. Global catalog — not station-scoped.
 */
import { eq, sql } from 'drizzle-orm';
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

export async function findAllFormats(): Promise<VehicleFormat[]> {
  return db.query.vehicleFormats.findMany({
    where: eq(vehicleFormats.is_active, true),
    orderBy: (vf, { asc }) => [asc(vf.label)],
  });
}

export async function findFormatById(formatId: string): Promise<VehicleFormat | undefined> {
  return db.query.vehicleFormats.findFirst({
    where: eq(vehicleFormats.id, formatId),
  });
}

export async function createFormat(data: CreateFormatData): Promise<VehicleFormat> {
  const [row] = await db
    .insert(vehicleFormats)
    .values({
      label: data.label,
      price: data.price,
      is_active: data.is_active,
    })
    .returning();
  if (!row) throw new Error('Insert vehicle format failed');
  return row;
}

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

export async function countReservationsByFormatId(formatId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reservations)
    .where(eq(reservations.vehicle_format_id, formatId));
  const raw = result[0]?.count;
  return typeof raw === 'number' ? raw : Number(raw ?? 0);
}

export async function deleteFormatById(id: string): Promise<void> {
  await db.delete(vehicleFormats).where(eq(vehicleFormats.id, id));
}
