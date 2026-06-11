import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db, type DbTransaction } from '@/lib/db';
import { stationPromotionEnrollments, stationPromotions } from '@/lib/db/schema';

export type StationPromotion = typeof stationPromotions.$inferSelect;
export type StationPromotionEnrollment = typeof stationPromotionEnrollments.$inferSelect;

type PromotionRow = StationPromotion & {
  commission_rate: string;
};

function toPromotion(row: StationPromotion | undefined): PromotionRow | undefined {
  if (!row) return undefined;
  return {
    ...row,
    commission_rate: String(row.commission_rate),
  };
}

export async function createStationPromotion(
  data: typeof stationPromotions.$inferInsert,
  tx?: DbTransaction,
): Promise<PromotionRow> {
  const client = tx ?? db;
  const [created] = await client.insert(stationPromotions).values(data).returning();
  if (!created) throw new Error('Failed to create station promotion');
  return toPromotion(created)!;
}

export async function deactivateStationPromotions(
  stationId: string,
  deactivatedAt: Date,
  tx?: DbTransaction,
): Promise<void> {
  const client = tx ?? db;
  await client
    .update(stationPromotions)
    .set({
      is_active: false,
      deactivated_at: deactivatedAt,
      updated_at: deactivatedAt,
    })
    .where(and(eq(stationPromotions.station_id, stationId), eq(stationPromotions.is_active, true)));
}

export async function findLatestStationPromotionByStationId(stationId: string): Promise<PromotionRow | undefined> {
  const row = await db.query.stationPromotions.findFirst({
    where: eq(stationPromotions.station_id, stationId),
    orderBy: [desc(stationPromotions.created_at)],
  });
  return toPromotion(row);
}

export async function findActiveStationPromotionByStationId(stationId: string): Promise<PromotionRow | undefined> {
  const row = await db.query.stationPromotions.findFirst({
    where: and(eq(stationPromotions.station_id, stationId), eq(stationPromotions.is_active, true)),
    orderBy: [desc(stationPromotions.created_at)],
  });
  return toPromotion(row);
}

export async function findStationPromotionByRefCode(refCode: string): Promise<PromotionRow | undefined> {
  const row = await db.query.stationPromotions.findFirst({
    where: eq(stationPromotions.ref_code, refCode),
  });
  return toPromotion(row);
}

export async function createStationPromotionEnrollment(
  data: typeof stationPromotionEnrollments.$inferInsert,
  tx?: DbTransaction,
): Promise<StationPromotionEnrollment> {
  const client = tx ?? db;
  const [created] = await client
    .insert(stationPromotionEnrollments)
    .values(data)
    .onConflictDoUpdate({
      target: [stationPromotionEnrollments.user_id, stationPromotionEnrollments.station_id],
      set: {
        promotion_id: data.promotion_id,
        updated_at: new Date(),
      },
    })
    .returning();
  if (!created) throw new Error('Failed to create station promotion enrollment');
  return created;
}

export async function findPromotionByUserAndStationIfCurrent(
  userId: string,
  stationId: string,
  now: Date,
): Promise<PromotionRow | undefined> {
  const rows = await db
    .select({
      promotion: stationPromotions,
    })
    .from(stationPromotionEnrollments)
    .innerJoin(stationPromotions, eq(stationPromotionEnrollments.promotion_id, stationPromotions.id))
    .where(
      and(
        eq(stationPromotionEnrollments.user_id, userId),
        eq(stationPromotionEnrollments.station_id, stationId),
        eq(stationPromotions.is_active, true),
        sql`${stationPromotions.expires_at} >= ${now}`,
        or(isNull(stationPromotions.deactivated_at), sql`${stationPromotions.deactivated_at} > ${now}`),
      ),
    )
    .limit(1);

  return toPromotion(rows[0]?.promotion);
}
