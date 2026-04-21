import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  adminLogs,
  pendingUploads,
  users,
  emailVerificationTokens,
  stations,
  stationDocuments,
  stationWashTypes,
  washTypes,
} from '@/lib/db/schema';
import {
  sendVerificationEmail,
  sendStationApprovalEmail,
  sendStationRejectionEmail,
  sendStationApplicationAdminNotification,
} from '@/lib/email';
import { APP_URL } from '@/helpers/constants';
import { buildStationQrPublicUrl } from '@/server/qr/qr-token-service';
import {
  createStripeConnectAccount,
} from '@/server/payments/payment-service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { findByEmail, findById, type SafeUser } from '@/server/auth/user-repository';
import {
  findStationById,
  findStationByUserId,
  findActiveStationWithDetail,
  getCompletedCountForStation,
  listActiveStations,
  listActiveStationsGroup,
  listStationsByStatus,
  listAllStationsForAdmin,
  updateStationInfo,
  type ListActiveStationsFilters,
  type Station,
  type StationWithAvailableSlots,
} from './station-repository';
import {
  findDocumentsByStationId,
  findPhotosByStationId,
  replaceStationPhotos,
  type StationPhoto,
} from './document-repository';
import { getCancellationPolicy } from '@/server/admin/platform-settings-service';


// %%%%% Types %%%%%

export type StationOnboardingDto = {
  // Step 1 — account credentials
  email: string;
  phone: string;
  password: string;

  // Step 2 — station details
  station_name: string;
  legal_name?: string;
  registration_number?: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  wash_post_count: number;
  /** At least one wash type id (UUID from wash_types table). */
  wash_type_ids: string[];
  description?: string;
  /** Type de prestation: optional; persisted as nullable on stations. */
  service_scope?: 'exterior' | 'interior' | 'both';

  // Step 3 — documents + legal (storage from onboarding upload; default cloudinary)
  documents: { document_type: string; file_url: string; storage?: 'cloudinary' | 'local' }[];
  terms_accepted: true;
};

export type StationOnboardingResult = {
  user: SafeUser;
  station: Station;
};

export type StationWithDocuments = Station & {
  documents: Awaited<ReturnType<typeof findDocumentsByStationId>>;
  photos: Awaited<ReturnType<typeof findPhotosByStationId>>;
};


// %%%%% END - Types %%%%%


// %%%%% Station onboarding %%%%%

/**
 * Creates the user account, station record, and documents in a single atomic
 * transaction. No DB writes happen until all three steps have been submitted.
 */
export async function completeStationOnboarding(
  dto: StationOnboardingDto,
  locale: 'fr' | 'en' = 'fr'
): Promise<StationOnboardingResult> {
  const existing = await findByEmail(dto.email);
  if (existing) throw new ConflictError('Email already in use');

  const password_hash = await bcrypt.hash(dto.password, 12);
  const verificationToken = randomUUID();

  const uniqueWashTypeIds = [...new Set(dto.wash_type_ids)];

  const { user, station } = await db.transaction(async (tx) => {
    // Validate wash type ids before inserting
    if (uniqueWashTypeIds.length) {
      const validRows = await tx
        .select({ id: washTypes.id })
        .from(washTypes)
        .where(and(inArray(washTypes.id, uniqueWashTypeIds), eq(washTypes.is_active, true)));
      if (validRows.length !== uniqueWashTypeIds.length) {
        throw new ValidationError('Invalid or inactive wash type id(s)');
      }
    }

    const [newUser] = await tx
      .insert(users)
      .values({
        email: dto.email,
        phone: dto.phone,
        password_hash,
        role: 'station',
        status: 'pending_verification',
      })
      .returning();

    await tx.insert(emailVerificationTokens).values({
      user_id: newUser.id,
      token: verificationToken,
      type: 'email_verification',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const [newStation] = await tx
      .insert(stations)
      .values({
        user_id: newUser.id,
        name: dto.station_name,
        legal_name: dto.legal_name,
        registration_number: dto.registration_number,
        address: dto.address,
        city: dto.city,
        latitude: dto.latitude?.toString(),
        longitude: dto.longitude?.toString(),
        description: dto.description,
        wash_post_count: dto.wash_post_count,
        service_scope: dto.service_scope ?? null,
        status: 'pending_admin_validation',
      })
      .returning();

    if (uniqueWashTypeIds.length) {
      await tx.insert(stationWashTypes).values(
        uniqueWashTypeIds.map((wash_type_id) => ({
          station_id: newStation.id,
          wash_type_id,
        }))
      );
    }

    const docRows = await tx
      .insert(stationDocuments)
      .values(
        dto.documents.map((d) => ({
          station_id: newStation.id,
          document_type: d.document_type,
          file_url: d.file_url,
          storage: d.storage ?? 'cloudinary',
          terms_accepted: dto.terms_accepted,
        }))
      )
      .returning();

    // Queue local files for Cloudinary sync
    for (const row of docRows) {
      if (row.storage === 'local') {
        await tx.insert(pendingUploads).values({
          station_document_id: row.id,
        });
      }
    }

    const { password_hash: _, ...safeUser } = newUser;
    return { user: safeUser as SafeUser, station: newStation };
  });

  // Fire-and-forget (station accounts have no first_name; use station name for greeting)
  sendVerificationEmail(user.email, dto.station_name ?? '', verificationToken, locale).catch(() => void 0);

  sendStationApplicationAdminNotification(station.name, station.id).catch(() => void 0);

  return { user, station };
}


// %%%%% END - Station onboarding %%%%%


// %%%%% Admin station management %%%%%

// ooooo Types ooooo
// Pagination metadata and list-item shapes for admin station endpoints.


export type PendingStationsMeta = {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

// M-5: Omit sensitive columns not needed for admin listing.
export type PendingStationAdminItem = Omit<Station, 'stripe_account_id' | 'rejection_reason'>;

export type PendingStationsResult = {
  stations: PendingStationAdminItem[];
  meta: PendingStationsMeta;
};


// ooooo END - Types ooooo


// ooooo Internal helpers ooooo
// Shared guards and data-shaping utilities used by multiple exported functions.

/**
 * Fetches a station and its owner user, throwing NotFoundError for either absence.
 * Centralises the identical guard used by approveStation and rejectStation.
 */
async function requireStationAndOwner(stationId: string, missingOwnerVerb: string) {
  const station = await findStationById(stationId);
  if (!station) throw new NotFoundError('Station not found');

  const stationUser = station.user_id ? await findById(station.user_id) : null;
  if (!stationUser) {
    throw new NotFoundError(`Station owner not found — cannot ${missingOwnerVerb} an orphaned station`);
  }

  return { station, stationUser };
}

/**
 * Strips columns that must not be surfaced outside the service layer.
 * Used by both getPendingStations and getStationsForAdmin to keep the omit
 * logic in one place.
 */
function stripSensitiveStationColumns<T extends { stripe_account_id?: unknown; rejection_reason?: unknown }>(
  row: T
): Omit<T, 'stripe_account_id' | 'rejection_reason'> {
  const { stripe_account_id: _s, rejection_reason: _r, ...rest } = row;
  return rest as Omit<T, 'stripe_account_id' | 'rejection_reason'>;
}

/**
 * Fetches a station row and fans out to documents + photos in parallel.
 * Throws NotFoundError when the station row is absent.
 */
async function fetchStationWithDocuments(
  station: Station | undefined,
  notFoundMessage: string
): Promise<StationWithDocuments> {
  if (!station) throw new NotFoundError(notFoundMessage);
  const [documents, photos] = await Promise.all([
    findDocumentsByStationId(station.id),
    findPhotosByStationId(station.id),
  ]);
  return { ...station, documents, photos };
}


// ooooo END - Internal helpers ooooo


/**
 * Returns a paginated list of stations in `pending_admin_validation` status.
 * Strips sensitive columns (`stripe_account_id`, `rejection_reason`) from each row.
 *
 * @param page    - 1-based page number (default 1).
 * @param perPage - Page size, capped to 100 (default 20).
 * @returns Paginated station list with metadata.
 */
export async function getPendingStations(page = 1, perPage = 20): Promise<PendingStationsResult> {
  const safePer = Math.min(100, Math.max(1, perPage)); // M-3: cap perPage in service, not only in validator
  const { rows, total } = await listStationsByStatus('pending_admin_validation', page, safePer);
  return {
    // M-5: Strip sensitive columns before returning.
    stations: rows.map(stripSensitiveStationColumns),
    meta: {
      total,
      page,
      per_page: safePer,
      total_pages: Math.max(1, Math.ceil(total / safePer)),
    },
  };
}

/**
 * Returns all stations for admin views, optionally filtered by status.
 * Strips `stripe_account_id` — consistent with getPendingStations; not needed by the admin UI.
 *
 * @param status - Optional status string to filter by (e.g. `'active'`, `'rejected'`).
 * @returns Array of station records with sensitive fields omitted.
 */
export async function getStationsForAdmin(status?: string): Promise<PendingStationAdminItem[]> {
  const rows = await listAllStationsForAdmin(status);
  return rows.map(stripSensitiveStationColumns);
}

/**
 * Returns a station by id with its associated documents and photos.
 *
 * @param id - Station UUID.
 * @returns Station record with documents and photos arrays attached.
 * @throws {NotFoundError} If the station does not exist.
 */
export async function getStationById(id: string): Promise<StationWithDocuments> {
  return fetchStationWithDocuments(await findStationById(id), 'Station not found');
}

/**
 * Approves a pending station: creates Stripe account, activates status, records audit log,
 * and optionally persists document expiry dates. Sends approval email fire-and-forget.
 *
 * @param adminId              - Admin performing the action
 * @param stationId            - Target station UUID
 * @param locale               - Email locale ('fr' | 'en')
 * @param documentExpiryDates  - Optional per-document expiry dates to record at approval time
 */
export async function approveStation(
  adminId: string,
  stationId: string,
  locale: 'fr' | 'en' = 'fr',
  documentExpiryDates?: Array<{ document_id: string; expiry_date: Date }>
): Promise<void> {
  // H-2: Fail hard — a station without an owner cannot be activated or receive payments.
  const { station, stationUser } = await requireStationAndOwner(stationId, 'approve');

  // M-1: Create Stripe account BEFORE activating so the station stays pending if Stripe fails.
  // The onboarding link is NOT generated here — it is a one-time resource that must be
  // fetched on-demand when the station owner navigates to the Stripe onboarding flow.
  const accountId = await createStripeConnectAccount(stationUser.email, stationId);

  // C-2 + H-1: Atomic conditional UPDATE + audit log in one transaction.
  // The WHERE on status ensures only one concurrent approve wins — the other gets 0 rows → 409.
  // NOTE: Stripe account creation is intentionally outside the transaction (M-1 comment above).
  // If the transaction fails (e.g. concurrent approval race), the accountId is orphaned in Stripe.
  // We log it at ERROR level so ops can deactivate/reconcile it manually.
  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(stations)
        .set({
          status: 'active',
          approved_by: adminId,
          approved_at: new Date(),
          stripe_account_id: accountId,
          updated_at: new Date(),
        })
        .where(and(eq(stations.id, stationId), eq(stations.status, 'pending_admin_validation')))
        .returning();

      if (!updated) {
        throw new ConflictError('Station is not pending validation');
      }

      // L-8: Include stripe_account_id in audit details for traceability.
      await tx.insert(adminLogs).values({
        admin_id: adminId,
        action: 'station_approved',
        target_type: 'station',
        target_id: stationId,
        details: { stripe_account_id: accountId, stripe_connected: true },
      });

      // Persist document expiry dates if provided.
      // One ownership check (SELECT...IN) replaces N serial selects; updates are
      // then applied only against the verified set. Silently skips any document_id
      // that does not belong to this station so the approval never fails on a bad
      // document reference.
      if (documentExpiryDates && documentExpiryDates.length > 0) {
        const requestedIds = documentExpiryDates.map((d) => d.document_id);
        const ownedRows = await tx
          .select({ id: stationDocuments.id })
          .from(stationDocuments)
          .where(
            and(
              inArray(stationDocuments.id, requestedIds),
              eq(stationDocuments.station_id, stationId)
            )
          );
        const ownedIds = new Set(ownedRows.map((r) => r.id));

        for (const { document_id, expiry_date } of documentExpiryDates) {
          if (!ownedIds.has(document_id)) continue;
          await tx
            .update(stationDocuments)
            .set({ expiry_date })
            .where(eq(stationDocuments.id, document_id));
        }
      }
    });
  } catch (txError) {
    // Log the orphaned Stripe account so it can be manually deactivated/reconciled.
    console.error('[APPROVE_STRIPE_ORPHAN]', {
      stationId,
      stripe_account_id: accountId,
      error: txError instanceof Error ? txError.message : String(txError),
    });
    throw txError;
  }

  let qrPublicUrl: string | undefined;
  try {
    qrPublicUrl = buildStationQrPublicUrl({ origin: APP_URL, locale, stationId: station.id });
  } catch (e) {
    console.error('[STATION_APPROVAL_QR_URL_GENERATION_FAILED]', {
      stationId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // M-4: stationUser already fetched (H-2) — no need for fire-and-forget user lookup.
  sendStationApprovalEmail(stationUser.email, station.name, locale, { qrPublicUrl })
    .catch((e) => console.error('[APPROVE_EMAIL_FAILED]', {
      stationId,
      error: e instanceof Error ? e.message : String(e),
    }));

  sendStationApplicationAdminNotification(station.name, station.id, { context: 'approval', qrPublicUrl })
    .catch(() => void 0);
}

/**
 * Rejects a pending station with a mandatory reason string.
 * Atomically updates status, increments rejection_count, and records audit log.
 * Sends rejection email fire-and-forget.
 *
 * @param adminId   - Admin performing the action
 * @param stationId - Target station UUID
 * @param reason    - Human-readable rejection reason (stored and emailed)
 */
export async function rejectStation(
  adminId: string,
  stationId: string,
  reason: string
): Promise<void> {
  // H-2: Fail hard — an orphaned station should not be silently rejected without notifying anyone.
  const { station, stationUser } = await requireStationAndOwner(stationId, 'reject');

  // C-2 + H-1: Atomic conditional UPDATE + audit log in one transaction.
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(stations)
      .set({
        status: 'rejected',
        rejection_reason: reason,
        rejection_count: sql`COALESCE(rejection_count, 0) + 1`,
        updated_at: new Date(),
      })
      .where(and(eq(stations.id, stationId), eq(stations.status, 'pending_admin_validation')))
      .returning();

    if (!updated) {
      throw new ConflictError('Station is not pending validation');
    }

    await tx.insert(adminLogs).values({
      admin_id: adminId,
      action: 'station_rejected',
      target_type: 'station',
      target_id: stationId,
      details: { reason },
    });
  });

  // M-4: Fire-and-forget email — log failures instead of silently swallowing them.
  sendStationRejectionEmail(stationUser.email, station.name, reason)
    .catch((e) => console.error('[REJECT_EMAIL_FAILED]', {
      stationId,
      error: e instanceof Error ? e.message : String(e),
    }));
}


// %%%%% END - Admin station management %%%%%


// %%%%% Station owner (my station) %%%%%

/**
 * Returns the station associated with the given user id, with its documents and photos.
 *
 * @param userId - Authenticated station owner's user UUID.
 * @returns Station record with documents and photos arrays attached.
 * @throws {NotFoundError} If no station is linked to this account.
 */
export async function getMyStation(userId: string): Promise<StationWithDocuments> {
  return fetchStationWithDocuments(
    await findStationByUserId(userId),
    'No station associated with this account'
  );
}

/**
 * Partially updates the profile fields of the station owned by the given user.
 * Only provided fields are updated; omitted fields are left unchanged.
 * If `wash_types` is provided, all existing junction rows are replaced atomically.
 *
 * @param userId - Authenticated station owner's user UUID.
 * @param data   - Partial station fields to apply.
 * @returns The updated station record.
 * @throws {NotFoundError}   If no station is linked to this account.
 * @throws {ValidationError} If any wash_type id is invalid or inactive.
 */
export async function updateMyStation(
  userId: string,
  data: {
    name?: string;
    description?: string | null;
    address?: string;
    city?: string;
    postal_code?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    service_scope?: 'exterior' | 'interior' | 'both' | null;
    wash_types?: string[];
  }
): Promise<Station> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  // Build a partial update payload containing only the fields explicitly provided.
  // latitude/longitude are stored as strings in the DB; null clears the value.
  const payload: Parameters<typeof updateStationInfo>[1] = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.address !== undefined && { address: data.address }),
    ...(data.city !== undefined && { city: data.city }),
    ...(data.postal_code !== undefined && { postal_code: data.postal_code }),
    ...(data.latitude !== undefined && { latitude: data.latitude != null ? String(data.latitude) : null }),
    ...(data.longitude !== undefined && { longitude: data.longitude != null ? String(data.longitude) : null }),
    ...(data.service_scope !== undefined && { service_scope: data.service_scope }),
  };

  // Validate wash types before touching the DB so a bad id never causes a partial update.
  let uniqueWashTypeIds: string[] | undefined;
  if (data.wash_types !== undefined) {
    uniqueWashTypeIds = [...new Set(data.wash_types)];
    // Guard: inArray requires at least one value; an empty array means "clear all" — no DB validation needed.
    if (uniqueWashTypeIds.length > 0) {
      const validRows = await db
        .select({ id: washTypes.id })
        .from(washTypes)
        .where(and(inArray(washTypes.id, uniqueWashTypeIds), eq(washTypes.is_active, true)));
      if (validRows.length !== uniqueWashTypeIds.length) {
        throw new ValidationError('Invalid or inactive wash type id(s)');
      }
    }
  }

  // Run profile update and wash-type replacement in one atomic transaction so a
  // failure in either half cannot leave the station in a split state.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(stations)
      .set({ ...payload, updated_at: new Date() })
      .where(eq(stations.id, station.id))
      .returning();
    if (!row) throw new NotFoundError('No station associated with this account');

    if (uniqueWashTypeIds !== undefined) {
      await tx.delete(stationWashTypes).where(eq(stationWashTypes.station_id, station.id));
      if (uniqueWashTypeIds.length > 0) {
        await tx.insert(stationWashTypes).values(
          uniqueWashTypeIds.map((wash_type_id) => ({ station_id: station.id, wash_type_id }))
        );
      }
    }

    return row;
  });

  return updated;
}

/**
 * Replaces all photos for the station owned by the given user.
 * Existing photos are deleted and the new set is inserted atomically.
 * An empty array clears all photos.
 *
 * @param userId - Authenticated station owner's user UUID.
 * @param photos - Ordered array of `{ url, position }` objects.
 * @returns The newly persisted photo rows.
 * @throws {NotFoundError} If no station is linked to this account.
 */
export async function updateMyStationPhotos(
  userId: string,
  photos: { url: string; position: number }[]
): Promise<StationPhoto[]> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('Station not found for this user');
  return replaceStationPhotos(station.id, photos);
}


// %%%%% END - Station owner (my station) %%%%%


// %%%%% Public API (Card 1) %%%%%

/**
 * List item for GET /api/v1/stations. Station row plus available (derived from slots),
 * available_slots, and optional completed_count for display.
 */
export type StationListPublicItem = Omit<StationWithAvailableSlots, 'available_slots' | 'completed_count'> & {
  available_slots: number;
  available: boolean;
  completed_count?: number;
};

export type ListStationsPublicMeta = {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export type ListStationsPublicData = {
  all: StationListPublicItem[];
  available_now?: StationListPublicItem[];
  most_appreciated?: StationListPublicItem[];
  most_visited?: StationListPublicItem[];
};

export type ListStationsPublicResult = {
  data: ListStationsPublicData;
  meta: ListStationsPublicMeta;
};

/**
 * Maps repository row to public list item (available_slots and completed_count as numbers).
 */
function toListPublicItem(row: StationWithAvailableSlots): StationListPublicItem {
  const available_slots = Math.max(0, Number(row.available_slots ?? 0));
  const available = available_slots > 0;
  const completed_count = row.completed_count != null ? Number(row.completed_count) : undefined;
  const { available_slots: _s, completed_count: _c, ...rest } = row;
  return { ...rest, available_slots, available, ...(completed_count !== undefined && { completed_count }) };
}

/**
 * Returns a paginated list of active stations and optional group arrays
 * (available_now, most_appreciated, most_visited).
 *
 * Response shape: `{ data: { all, ...groups }, meta: { total, page, per_page, total_pages } }`.
 * Backward compatible: when no `groups` filter is provided, only `data.all` and `meta` are set.
 *
 * @param filters - Pagination, search, and group filters.
 * @returns Paginated result with group sub-arrays when requested.
 */
export async function listStationsPublic(
  filters: ListActiveStationsFilters
): Promise<ListStationsPublicResult> {
  const page = Math.max(1, filters.page ?? 1);
  const per_page = Math.min(100, Math.max(1, filters.per_page ?? 20));
  const { rows, total } = await listActiveStations({ ...filters, page, per_page });
  const total_pages = Math.max(1, Math.ceil(total / per_page));

  const data: ListStationsPublicData = {
    all: rows.map(toListPublicItem),
  };

  const groups = filters.groups;
  const limitPerGroup = filters.limit_per_group ?? 50;
  if (groups?.length) {
    const groupPromises = groups.map((group) =>
      listActiveStationsGroup(group, filters, limitPerGroup).then((r) => r.map(toListPublicItem))
    );
    const results = await Promise.all(groupPromises);
    groups.forEach((g, i) => {
      if (g === 'available_now') data.available_now = results[i];
      else if (g === 'most_appreciated') data.most_appreciated = results[i];
      else if (g === 'most_visited') data.most_visited = results[i];
    });
  }

  return { data, meta: { total, page, per_page, total_pages } };
}

/**
 * Returns a single active station with config, vehicle formats, and time slots.
 * Includes `available` and `available_slots` computed from timeSlots (start_time > NOW()).
 * Includes `completed_count` (Services terminés) from reservations with completed_at IS NOT NULL.
 * Includes `free_cancellation_minutes` from the platform cancellation policy.
 *
 * @param id - Station UUID.
 * @returns Augmented station detail object.
 * @throws {NotFoundError} If the station does not exist or is not active.
 */
export async function getStationDetailPublic(id: string) {
  const station = await findActiveStationWithDetail(id);
  if (!station) throw new NotFoundError('Station not found');

  // Derive available_slots from future time slots only.
  const now = new Date();
  const available_slots = (station.timeSlots ?? [])
    .filter((s: { start_time: Date }) => s.start_time > now)
    .reduce(
      (sum: number, s: { capacity: number; booked_count: number }) =>
        sum + Math.max(0, (s.capacity ?? 0) - (s.booked_count ?? 0)),
      0
    );

  // Unavailability derived only from slot availability; no API toggle for is_open (Figma gap).
  const available = available_slots > 0;

  const [completed_count, cancellationPolicy] = await Promise.all([
    getCompletedCountForStation(id),
    getCancellationPolicy(),
  ]);

  return {
    ...station,
    available_slots,
    available,
    completed_count,
    free_cancellation_minutes: cancellationPolicy.freeWindowMinutes,
  };
}

/**
 * "Client en route": builds a Google Maps URL for an active station from lat/lng or address.
 * Falls back to `address, city` when coordinates are not stored.
 *
 * @param id - Station UUID.
 * @returns Object containing the resolved Google Maps URL.
 * @throws {NotFoundError} If the station does not exist or is not active.
 */
export async function getStationJoinPublic(id: string): Promise<{ mapsUrl: string }> {
  const station = await findStationById(id);
  if (!station || station.status !== 'active') throw new NotFoundError('Station not found');

  // latitude / longitude are stored as string | null (decimal column).
  const { latitude: lat, longitude: lng } = station;
  const q =
    lat != null && lng != null
      ? encodeURIComponent(`${lat},${lng}`)
      : encodeURIComponent([station.address, station.city].filter(Boolean).join(', '));

  const mapsUrl = `https://www.google.com/maps?q=${q}`;
  return { mapsUrl };
}


// %%%%% END - Public API (Card 1) %%%%%
