/**
 * Data access for vehicle_formats. Global catalog — not station-scoped.
 */
import { and, eq, ne, sql } from 'drizzle-orm';
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

export async function findFormatsPaginated(
  page: number,
  perPage: number
): Promise<{ items: VehicleFormat[]; total: number }> {
  const safePerPage = Math.min(Math.max(1, Math.floor(perPage)), 100);
  const safePage = Math.max(1, Math.floor(page));
  const offset = (safePage - 1) * safePerPage;
  const [countRows, items] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicleFormats)
      .where(eq(vehicleFormats.is_active, true)),
    db.query.vehicleFormats.findMany({
      where: eq(vehicleFormats.is_active, true),
      orderBy: (vf, { asc }) => [asc(vf.label)],
      limit: safePerPage,
      offset,
    }),
  ]);
  return { items, total: countRows[0]?.count ?? 0 };
}

export async function findFormatById(formatId: string): Promise<VehicleFormat | undefined> {
  return db.query.vehicleFormats.findFirst({
    where: eq(vehicleFormats.id, formatId),
  });
}

/**
 * Case-insensitive lookup by trimmed label. Used to enforce uniqueness
 * before insert / update so the service can return a friendly
 * ConflictError instead of a raw unique-violation from Postgres.
 */
export async function findFormatByNormalizedLabel(
  label: string,
  excludeId?: string,
): Promise<VehicleFormat | undefined> {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return undefined;
  const conditions = [sql`lower(btrim(${vehicleFormats.label})) = ${normalized}`];
  if (excludeId) conditions.push(ne(vehicleFormats.id, excludeId));
  return db.query.vehicleFormats.findFirst({ where: and(...conditions) });
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
