import 'server-only';

import { buildPromoReferralUrl, generatePromoRefCode, normalizePromoCommissionRatePercent } from '@/server/station/promo-qr-service';
import {
  createStationPromotion,
  deactivateStationPromotions,
  findActiveStationPromotionByStationId,
  findLatestStationPromotionByStationId,
  findPromotionByUserAndStationIfCurrent,
  findStationPromotionByRefCode,
  createStationPromotionEnrollment,
  type StationPromotion,
} from './station-promotion-repository';
import { buildStationQrResolverUrl } from '@/server/qr/qr-token-service';

export type PromotionLocale = 'fr' | 'en';
export type PromotionSummary = Pick<StationPromotion, 'is_active' | 'expires_at'> | null | undefined;

/**
 * Determines whether a promotion is already expired
 *
 * Compares the stored promotion expiry against a reference clock to decide
 * whether downstream promo flows should stop applying it. The optional `now`
 * argument exists primarily to keep tests deterministic and to share the same
 * expiration rule across resolver, registration, and reservation flows.
 *
 * @param {Date} expiresAt - Promotion end timestamp persisted in the database
 * @param {Date} [now=new Date()] - Reference time used for the expiration comparison
 * @returns {boolean} `true` when `expiresAt` is strictly earlier than `now`; otherwise `false`
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const expired = isPromotionExpired(new Date('2026-06-01T00:00:00.000Z'));
 *
 * @example
 * const expired = isPromotionExpired(
 *   new Date('2026-06-12T10:00:00.000Z'),
 *   new Date('2026-06-12T09:00:00.000Z'),
 * );
 * console.log(expired); // false
 *
 * @example
 * const expired = isPromotionExpired(
 *   new Date('2026-06-12T08:00:00.000Z'),
 *   new Date('2026-06-12T09:00:00.000Z'),
 * );
 * console.log(expired); // true
 */
export function isPromotionExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() < now.getTime();
}

/**
 * Determines whether a promotion can still be applied
 *
 * Centralizes the shared promotion validity rule used across QR resolution,
 * referral lookup, and reservation commission calculations. A promotion is
 * considered valid only when it exists, is still marked active, and has not
 * yet reached its expiration timestamp.
 *
 * @param {PromotionSummary} promotion - Promotion snapshot or `null`/`undefined` when none exists
 * @param {Date} [now=new Date()] - Reference time used for the expiration comparison
 * @returns {boolean} `true` when the promotion exists, is active, and remains unexpired
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const valid = isPromotionCurrentlyValid({
 *   is_active: true,
 *   expires_at: new Date('2099-01-01T00:00:00.000Z'),
 * });
 *
 * @example
 * const valid = isPromotionCurrentlyValid(null);
 * console.log(valid); // false
 *
 * @example
 * const valid = isPromotionCurrentlyValid({
 *   is_active: false,
 *   expires_at: new Date('2099-01-01T00:00:00.000Z'),
 * });
 * console.log(valid); // false
 */
export function isPromotionCurrentlyValid(
  promotion: PromotionSummary,
  now = new Date(),
): boolean {
  if (!promotion || !promotion.is_active) return false;
  return !isPromotionExpired(promotion.expires_at, now);
}

/**
 * Retrieves the station promotion currently eligible for new QR scans
 *
 * Loads the station's active promotion candidate from the repository and then
 * filters it through the shared validity rule. This keeps resolver flows from
 * exposing stale promotions that remain flagged active in storage but are
 * already expired by time.
 *
 * @param {string} stationId - Station UUID whose active promotion should be checked
 * @param {Date} [now=new Date()] - Reference time used to evaluate expiration
 * @returns {Promise<StationPromotion | null>} Valid active promotion row, or `null` when none is currently usable
 * @throws {Error} Propagates repository or database errors from the underlying query
 *
 * @example
 * const promotion = await findCurrentPromotionForStation('station-123');
 *
 * @example
 * const promotion = await findCurrentPromotionForStation(
 *   'station-123',
 *   new Date('2026-06-12T12:00:00.000Z'),
 * );
 *
 * @example
 * if (!(await findCurrentPromotionForStation('station-123'))) {
 *   console.log('No active promotion');
 * }
 */
export async function findCurrentPromotionForStation(stationId: string, now = new Date()) {
  const promotion = await findActiveStationPromotionByStationId(stationId);
  if (!promotion || !isPromotionCurrentlyValid(promotion, now)) return null;
  return promotion;
}

/**
 * Resolves a public promo reference code into a currently valid promotion
 *
 * This is used by promo signup and referral endpoints to translate a scanned
 * or typed referral code into the backing station promotion. It rejects codes
 * that point to inactive or expired promotions so public callers only receive
 * still-applicable offers.
 *
 * @param {string} refCode - Public referral code stored on the station promotion row
 * @param {Date} [now=new Date()] - Reference time used to evaluate expiration
 * @returns {Promise<StationPromotion | null>} Matching valid promotion row, or `null` when the code is unusable
 * @throws {Error} Propagates repository or database errors from the underlying query
 *
 * @example
 * const promotion = await resolvePromotionByRefCode('abc123');
 *
 * @example
 * const promotion = await resolvePromotionByRefCode(
 *   'abc123',
 *   new Date('2026-06-12T12:00:00.000Z'),
 * );
 *
 * @example
 * if (!(await resolvePromotionByRefCode('missing-code'))) {
 *   console.log('Referral not found');
 * }
 */
export async function resolvePromotionByRefCode(refCode: string, now = new Date()) {
  const promotion = await findStationPromotionByRefCode(refCode);
  if (!promotion || !isPromotionCurrentlyValid(promotion, now)) return null;
  return promotion;
}

/**
 * Creates the persistent promo enrollment for a newly registered user
 *
 * Stores the link between a client account, the station they signed up
 * through, and the promotion that was active during signup. Later reservation
 * flows use this enrollment to re-check validity without requiring another QR
 * scan from the client.
 *
 * @param {{ userId: string; stationId: string; promotionId: string }} params - Enrollment identifiers
 * @param {string} params.userId - Newly created client user UUID
 * @param {string} params.stationId - Station UUID that originated the signup
 * @param {string} params.promotionId - Promotion UUID that should govern later reservations
 * @returns {Promise<import('./station-promotion-repository').StationPromotionEnrollment>} Upserted enrollment row
 * @throws {Error} Propagates repository or database errors from the enrollment write
 *
 * @example
 * await createPromotionEnrollmentForUser({
 *   userId: 'user-123',
 *   stationId: 'station-123',
 *   promotionId: 'promo-123',
 * });
 *
 * @example
 * const enrollment = await createPromotionEnrollmentForUser({
 *   userId: 'user-123',
 *   stationId: 'station-123',
 *   promotionId: 'promo-456',
 * });
 * console.log(enrollment.station_id);
 *
 * @example
 * await createPromotionEnrollmentForUser({
 *   userId: 'user-123',
 *   stationId: 'station-123',
 *   promotionId: 'promo-123',
 * });
 */
export async function createPromotionEnrollmentForUser(params: {
  userId: string;
  stationId: string;
  promotionId: string;
}) {
  return createStationPromotionEnrollment({
    user_id: params.userId,
    station_id: params.stationId,
    promotion_id: params.promotionId,
  });
}

/**
 * Finds the enrolled promotion that can still affect a reservation
 *
 * Reservation flows call this helper to discover whether a user has a valid
 * promo enrollment for the target station at booking time. The repository
 * query already filters by active flag, expiration, and deactivation window.
 *
 * @param {string} userId - Client UUID making the reservation
 * @param {string} stationId - Station UUID receiving the reservation
 * @param {Date} [now=new Date()] - Reference time used to evaluate validity
 * @returns {Promise<StationPromotion | undefined>} Current applicable promotion row, or `undefined` when none applies
 * @throws {Error} Propagates repository or database errors from the lookup
 *
 * @example
 * const promotion = await findApplicablePromotionForUserReservation('user-123', 'station-123');
 *
 * @example
 * const promotion = await findApplicablePromotionForUserReservation(
 *   'user-123',
 *   'station-123',
 *   new Date('2026-06-12T12:00:00.000Z'),
 * );
 *
 * @example
 * if (!(await findApplicablePromotionForUserReservation('user-123', 'station-123'))) {
 *   console.log('No promo applies');
 * }
 */
export async function findApplicablePromotionForUserReservation(
  userId: string,
  stationId: string,
  now = new Date(),
) {
  return findPromotionByUserAndStationIfCurrent(userId, stationId, now);
}

/**
 * Creates a fresh station promotion after deactivating any current one
 *
 * Admin promo generation uses this helper to preserve a one-active-promo-per-
 * station invariant while still keeping historical promotion rows for audit
 * purposes. It derives the public referral code and normalized commission
 * reduction rate before inserting the replacement promotion row.
 *
 * @param {{ adminId: string; stationId: string; commissionRatePercent: number; expiresAt: Date }} params - Promotion creation input
 * @param {string} params.adminId - Admin UUID responsible for the promotion change
 * @param {string} params.stationId - Station UUID receiving the new promotion
 * @param {number} params.commissionRatePercent - Reduction percentage in the 0..100 admin input scale
 * @param {Date} params.expiresAt - Promotion expiration timestamp
 * @returns {Promise<StationPromotion>} Newly created active promotion row
 * @throws {Error} Propagates repository or helper errors during code generation, deactivation, or insert
 *
 * @example
 * const promotion = await createStationPromotionWithDeactivation({
 *   adminId: 'admin-123',
 *   stationId: 'station-123',
 *   commissionRatePercent: 50,
 *   expiresAt: new Date('2026-07-01T23:59:59.999Z'),
 * });
 *
 * @example
 * const promotion = await createStationPromotionWithDeactivation({
 *   adminId: 'admin-123',
 *   stationId: 'station-123',
 *   commissionRatePercent: 100,
 *   expiresAt: new Date('2026-06-30T23:59:59.999Z'),
 * });
 *
 * @example
 * console.log(
 *   (await createStationPromotionWithDeactivation({
 *     adminId: 'admin-123',
 *     stationId: 'station-123',
 *     commissionRatePercent: 5,
 *     expiresAt: new Date('2026-06-20T23:59:59.999Z'),
 *   })).is_active,
 * );
 */
export async function createStationPromotionWithDeactivation(params: {
  adminId: string;
  stationId: string;
  commissionRatePercent: number;
  expiresAt: Date;
}) {
  const now = new Date();
  const refCode = generatePromoRefCode({
    stationId: params.stationId,
    commissionRatePercent: params.commissionRatePercent,
    generatedAt: now,
  });
  const commissionRate = normalizePromoCommissionRatePercent(params.commissionRatePercent);

  await deactivateStationPromotions(params.stationId, now);

  return createStationPromotion({
    station_id: params.stationId,
    created_by_admin_id: params.adminId,
    commission_rate: commissionRate.toFixed(4),
    ref_code: refCode,
    is_active: true,
    expires_at: params.expiresAt,
  });
}

/**
 * Builds the public registration URL for an active promotion
 *
 * Wraps the lower-level promo URL helper so the rest of the promo stack does
 * not need to know where referral URLs are assembled. This keeps the service
 * layer as the single place that describes which links belong to promotion
 * resolution flows.
 *
 * @param {{ origin: string; locale: PromotionLocale; refCode: string }} params - URL generation options
 * @param {string} params.origin - Absolute application origin such as `https://app.example.com`
 * @param {PromotionLocale} params.locale - Locale prefix for the registration page
 * @param {string} params.refCode - Promotion referral code embedded in the URL
 * @returns {string} Absolute localized promotion referral URL
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const url = buildPromotionReferralUrl({
 *   origin: 'https://app.example.com',
 *   locale: 'fr',
 *   refCode: 'abc123',
 * });
 *
 * @example
 * const url = buildPromotionReferralUrl({
 *   origin: 'https://app.example.com',
 *   locale: 'en',
 *   refCode: 'abc123',
 * });
 *
 * @example
 * console.log(
 *   buildPromotionReferralUrl({
 *     origin: 'https://app.example.com',
 *     locale: 'fr',
 *     refCode: 'abc123',
 *   }),
 * );
 */
export function buildPromotionReferralUrl(params: {
  origin: string;
  locale: PromotionLocale;
  refCode: string;
}) {
  return buildPromoReferralUrl(params);
}

/**
 * Builds the canonical resolver URL for a station QR
 *
 * Exposes the shared QR URL that admin pages, station dashboards, and email
 * notifications should all reuse. Keeping this URL generation in one place
 * prevents drift between surfaces that expose the same station QR asset.
 *
 * @param {{ origin: string; stationId: string }} params - Resolver URL generation input
 * @param {string} params.origin - Absolute application origin such as `https://app.example.com`
 * @param {string} params.stationId - Station UUID to embed in the resolver path
 * @returns {string} Absolute canonical station QR resolver URL
 * @throws {Error} Propagates QR token generation errors from the QR service
 *
 * @example
 * const url = buildCanonicalStationQrUrl({
 *   origin: 'https://app.example.com',
 *   stationId: 'station-123',
 * });
 *
 * @example
 * const url = buildCanonicalStationQrUrl({
 *   origin: 'https://app.example.com/',
 *   stationId: 'station-123',
 * });
 *
 * @example
 * console.log(
 *   buildCanonicalStationQrUrl({
 *     origin: 'https://app.example.com',
 *     stationId: 'station-123',
 *   }),
 * );
 */
export function buildCanonicalStationQrUrl(params: {
  origin: string;
  stationId: string;
}) {
  return buildStationQrResolverUrl(params);
}

/**
 * Retrieves the latest promotion snapshot for a station
 *
 * Admin pages use this helper when they need the most recent promotion row
 * regardless of whether it is still active. This allows audit logging and UI
 * summaries to reflect the latest generated promo even after replacement.
 *
 * @param {string} stationId - Station UUID whose latest promotion row should be fetched
 * @returns {Promise<StationPromotion | undefined>} Most recent promotion row, or `undefined` when the station has never had one
 * @throws {Error} Propagates repository or database errors from the lookup
 *
 * @example
 * const snapshot = await getLatestPromotionSnapshot('station-123');
 *
 * @example
 * if (!(await getLatestPromotionSnapshot('station-123'))) {
 *   console.log('No promotion history yet');
 * }
 *
 * @example
 * const snapshot = await getLatestPromotionSnapshot('station-123');
 * console.log(snapshot?.ref_code ?? null);
 */
export async function getLatestPromotionSnapshot(stationId: string) {
  return findLatestStationPromotionByStationId(stationId);
}
