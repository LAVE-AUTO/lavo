import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stations } from '@/lib/db/schema';

export type Station = typeof stations.$inferSelect;
export type NewStation = typeof stations.$inferInsert;

export async function createStation(data: NewStation): Promise<Station> {
  const [station] = await db.insert(stations).values(data).returning();
  return station;
}

export async function findStationById(id: string): Promise<Station | undefined> {
  return db.query.stations.findFirst({ where: eq(stations.id, id) });
}

export async function findStationByUserId(userId: string): Promise<Station | undefined> {
  return db.query.stations.findFirst({ where: eq(stations.user_id, userId) });
}

export async function listStationsByStatus(status: string): Promise<Station[]> {
  return db.query.stations.findMany({ where: eq(stations.status, status) });
}

export async function updateStationStatus(
  id: string,
  status: string,
  extra?: Partial<Pick<Station, 'approved_by' | 'approved_at' | 'rejection_reason'>>
): Promise<void> {
  await db
    .update(stations)
    .set({ status, updated_at: new Date(), ...extra })
    .where(eq(stations.id, id));
}

export async function updateStationInfo(
  id: string,
  data: Partial<NewStation>
): Promise<Station> {
  const [updated] = await db
    .update(stations)
    .set({ ...data, updated_at: new Date() })
    .where(eq(stations.id, id))
    .returning();
  return updated;
}
