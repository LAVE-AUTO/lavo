import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db, type DbTransaction } from '@/lib/db';
import { stationPromotionEnrollments, stationPromotions } from '@/lib/db/schema';

export type StationPromotion = typeof stationPromotions.$inferSelect;
export type StationPromotionEnrollment = typeof stationPromotionEnrollments.$inferSelect;

type PromotionRow = StationPromotion & {
  commission_rate: string;
};

/**
 * Normalizes a station promotion row returned by Drizzle
 *
 * Drizzle can materialize numeric columns as driver-specific values depending
 * on the environment. This helper converts the commission rate into the string
 * representation expected by the surrounding promo and reservation services so
 * downstream calculations stay consistent.
 *
 * @param {StationPromotion | undefined} row - Raw station promotion row from Drizzle, if one was found
 * @returns {PromotionRow | undefined} Promotion row with `commission_rate` coerced to string, or `undefined` when no row exists
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const normalized = toPromotion(undefined);
 * console.log(normalized); // undefined
 *
 * @example
 * const normalized = toPromotion({
 *   ...row,
 *   commission_rate: row.commission_rate,
 * });
 *
 * @example
 * const normalized = toPromotion(row);
 * console.log(typeof normalized?.commission_rate); // 'string'
 */
function toPromotion(row: StationPromotion | undefined): PromotionRow | undefined {
  if (!row) return undefined;
  return {
    ...row,
    commission_rate: String(row.commission_rate),
  };
}

/**
 * Inserts a new station promotion row
 *
 * Creates the promotion record inside either the shared database client or the
 * caller-provided transaction. This repository helper is the write primitive
 * used when an admin generates or replaces a station promotion.
 *
 * @param {typeof stationPromotions.$inferInsert} data - Insert payload matching the `station_promotions` schema
 * @param {DbTransaction} [tx] - Optional open transaction to participate in a wider write flow
 * @returns {Promise<PromotionRow>} Newly created promotion row with normalized `commission_rate`
 * @throws {Error} If the insert unexpectedly returns no row
 *
 * @example
 * const promotion = await createStationPromotion({
 *   station_id: 'station-123',
 *   created_by_admin_id: 'admin-123',
 *   commission_rate: '0.5000',
 *   ref_code: 'abc123',
 *   is_active: true,
 *   expires_at: new Date('2026-07-01T23:59:59.999Z'),
 * });
 *
 * @example
 * await db.transaction(async (tx) => {
 *   await createStationPromotion(data, tx);
 * });
 *
 * @example
 * const promotion = await createStationPromotion(data);
 * console.log(promotion.station_id);
 */
export async function createStationPromotion(
  data: typeof stationPromotions.$inferInsert,
  tx?: DbTransaction,
): Promise<PromotionRow> {
  const client = tx ?? db;
  const [created] = await client.insert(stationPromotions).values(data).returning();
  if (!created) throw new Error('Failed to create station promotion');
  return toPromotion(created)!;
}

/**
 * Deactivates all currently active promotions for a station
 *
 * Marks active promotions inactive before a replacement promo is inserted so
 * the service layer can maintain a single-current-promo invariant per station.
 * Historical rows remain in place with deactivation timestamps for audit use.
 *
 * @param {string} stationId - Station UUID whose active promotions should be deactivated
 * @param {Date} deactivatedAt - Timestamp written into `deactivated_at` and `updated_at`
 * @param {DbTransaction} [tx] - Optional open transaction to participate in a wider write flow
 * @returns {Promise<void>} Promise that resolves once the update statement completes
 * @throws {Error} Propagates database errors from the update query
 *
 * @example
 * await deactivateStationPromotions('station-123', new Date());
 *
 * @example
 * await db.transaction(async (tx) => {
 *   await deactivateStationPromotions('station-123', new Date(), tx);
 * });
 *
 * @example
 * await deactivateStationPromotions(
 *   'station-123',
 *   new Date('2026-06-12T12:00:00.000Z'),
 * );
 */
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

/**
 * Retrieves the most recently created promotion for a station
 *
 * Returns the latest promotion row regardless of its current active status so
 * admin surfaces can display the newest generated promo and compare snapshots
 * for audit logs or UI summaries.
 *
 * @param {string} stationId - Station UUID whose latest promotion should be fetched
 * @returns {Promise<PromotionRow | undefined>} Latest promotion row, or `undefined` when none exists
 * @throws {Error} Propagates database errors from the read query
 *
 * @example
 * const promotion = await findLatestStationPromotionByStationId('station-123');
 *
 * @example
 * if (!(await findLatestStationPromotionByStationId('station-123'))) {
 *   console.log('No promotion history');
 * }
 *
 * @example
 * const promotion = await findLatestStationPromotionByStationId('station-123');
 * console.log(promotion?.created_at ?? null);
 */
export async function findLatestStationPromotionByStationId(stationId: string): Promise<PromotionRow | undefined> {
  const row = await db.query.stationPromotions.findFirst({
    where: eq(stationPromotions.station_id, stationId),
    orderBy: [desc(stationPromotions.created_at)],
  });
  return toPromotion(row);
}

/**
 * Retrieves the active promotion row for a station
 *
 * Reads the promotion currently flagged active in storage without performing
 * additional expiration checks. Higher-level services call this repository
 * helper first and then apply business validity rules such as expiration.
 *
 * @param {string} stationId - Station UUID whose active promotion should be fetched
 * @returns {Promise<PromotionRow | undefined>} Active promotion row, or `undefined` when no row is flagged active
 * @throws {Error} Propagates database errors from the read query
 *
 * @example
 * const promotion = await findActiveStationPromotionByStationId('station-123');
 *
 * @example
 * const promotion = await findActiveStationPromotionByStationId('station-123');
 * console.log(Boolean(promotion?.is_active));
 *
 * @example
 * if (!(await findActiveStationPromotionByStationId('station-123'))) {
 *   console.log('No active promotion row');
 * }
 */
export async function findActiveStationPromotionByStationId(stationId: string): Promise<PromotionRow | undefined> {
  const row = await db.query.stationPromotions.findFirst({
    where: and(eq(stationPromotions.station_id, stationId), eq(stationPromotions.is_active, true)),
    orderBy: [desc(stationPromotions.created_at)],
  });
  return toPromotion(row);
}

/**
 * Retrieves a promotion row by its public referral code
 *
 * Public resolver and registration flows use referral codes instead of direct
 * promotion ids. This repository helper translates that external code into the
 * backing promotion row without applying any active or expiration filtering.
 *
 * @param {string} refCode - Public referral code stored on the promotion row
 * @returns {Promise<PromotionRow | undefined>} Matching promotion row, or `undefined` when the code is unknown
 * @throws {Error} Propagates database errors from the read query
 *
 * @example
 * const promotion = await findStationPromotionByRefCode('abc123');
 *
 * @example
 * if (!(await findStationPromotionByRefCode('missing'))) {
 *   console.log('Promotion not found');
 * }
 *
 * @example
 * const promotion = await findStationPromotionByRefCode('abc123');
 * console.log(promotion?.station_id ?? null);
 */
export async function findStationPromotionByRefCode(refCode: string): Promise<PromotionRow | undefined> {
  const row = await db.query.stationPromotions.findFirst({
    where: eq(stationPromotions.ref_code, refCode),
  });
  return toPromotion(row);
}

/**
 * Upserts the promotion enrollment for a user and station pair
 *
 * Stores which promotion should govern a client's later reservations for a
 * station. If the user already has an enrollment for that station, the write
 * updates the promotion reference instead of inserting a duplicate row.
 *
 * @param {typeof stationPromotionEnrollments.$inferInsert} data - Enrollment insert payload matching the schema
 * @param {DbTransaction} [tx] - Optional open transaction to participate in a wider write flow
 * @returns {Promise<StationPromotionEnrollment>} Inserted or updated enrollment row returned by the database
 * @throws {Error} If the upsert unexpectedly returns no row
 *
 * @example
 * await createStationPromotionEnrollment({
 *   user_id: 'user-123',
 *   station_id: 'station-123',
 *   promotion_id: 'promo-123',
 * });
 *
 * @example
 * await db.transaction(async (tx) => {
 *   await createStationPromotionEnrollment(data, tx);
 * });
 *
 * @example
 * const enrollment = await createStationPromotionEnrollment(data);
 * console.log(enrollment.user_id);
 */
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

/**
 * Finds the current promotion applicable to a user's reservation
 *
 * Joins the enrollment and promotion tables to ensure the user is still tied
 * to the station through a promotion that remains active, unexpired, and not
 * later deactivated. Reservation pricing uses this query as the final source
 * of truth before applying a promo commission reduction.
 *
 * @param {string} userId - Client UUID whose enrollment should be checked
 * @param {string} stationId - Station UUID the client is booking against
 * @param {Date} now - Reference time used to filter expired or deactivated promotions
 * @returns {Promise<PromotionRow | undefined>} Applicable promotion row, or `undefined` when no valid enrollment remains
 * @throws {Error} Propagates database errors from the join query
 *
 * @example
 * const promotion = await findPromotionByUserAndStationIfCurrent(
 *   'user-123',
 *   'station-123',
 *   new Date(),
 * );
 *
 * @example
 * if (!(await findPromotionByUserAndStationIfCurrent('user-123', 'station-123', new Date()))) {
 *   console.log('No current enrollment');
 * }
 *
 * @example
 * const promotion = await findPromotionByUserAndStationIfCurrent(
 *   'user-123',
 *   'station-123',
 *   new Date('2026-06-12T12:00:00.000Z'),
 * );
 * console.log(promotion?.commission_rate ?? null);
 */
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
