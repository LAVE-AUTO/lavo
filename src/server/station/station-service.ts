import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { and, eq, inArray } from 'drizzle-orm';
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
  createStripeOnboardingLink,
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
import { findDocumentsByStationId } from './document-repository';
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


/**
 * Returns a paginated list of stations in pending_admin_validation status.
 * Strips sensitive columns (stripe_account_id, rejection_reason) from each row.
 */
export async function getPendingStations(page = 1, perPage = 20): Promise<PendingStationsResult> {
  const safePer = Math.min(100, Math.max(1, perPage)); // M-3: cap perPage in service, not only in validator
  const { rows, total } = await listStationsByStatus('pending_admin_validation', page, safePer);
  return {
    // M-5: Strip sensitive columns before returning.
    stations: rows.map(({ stripe_account_id: _s, rejection_reason: _r, ...rest }) => rest),
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
 */
export async function getStationsForAdmin(status?: string): Promise<Station[]> {
  return listAllStationsForAdmin(status);
}


/**
 * Returns a station by id with its associated documents.
 * Throws NotFoundError if the station does not exist.
 */
export async function getStationById(id: string): Promise<StationWithDocuments> {
  const station = await findStationById(id);
  if (!station) throw new NotFoundError('Station not found');

  const documents = await findDocumentsByStationId(id);
  return { ...station, documents };
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
  const station = await findStationById(stationId);
  if (!station) throw new NotFoundError('Station not found');

  // H-2: Fail hard — a station without an owner cannot be activated or receive payments.
  const stationUser = station.user_id ? await findById(station.user_id) : null;
  if (!stationUser) {
    throw new NotFoundError('Station owner not found — cannot approve an orphaned station');
  }

  // M-1: Create Stripe account BEFORE activating so the station stays pending if Stripe fails.
  const accountId = await createStripeConnectAccount(stationUser.email, stationId);
  await createStripeOnboardingLink(accountId);

  // C-2 + H-1: Atomic conditional UPDATE + audit log in one transaction.
  // The WHERE on status ensures only one concurrent approve wins — the other gets 0 rows → 409.
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

    // Persist document expiry dates if provided. Silently skip any document_id
    // that does not belong to this station to ensure the approval never fails
    // because of a bad document reference.
    if (documentExpiryDates && documentExpiryDates.length > 0) {
      for (const { document_id, expiry_date } of documentExpiryDates) {
        const [owned] = await tx
          .select({ id: stationDocuments.id })
          .from(stationDocuments)
          .where(
            and(
              eq(stationDocuments.id, document_id),
              eq(stationDocuments.station_id, stationId)
            )
          )
          .limit(1);
        if (!owned) continue;
        await tx
          .update(stationDocuments)
          .set({ expiry_date })
          .where(eq(stationDocuments.id, document_id));
      }
    }
  });

  let qrPublicUrl: string | undefined;
  try {
    qrPublicUrl = buildStationQrPublicUrl({ origin: APP_URL, locale, stationId: station.id });
  } catch (e) {
    console.error('[STATION_APPROVAL_QR_URL_GENERATION_FAILED]', { stationId, error: e instanceof Error ? e.message : String(e) });
  }

  // M-4: stationUser already fetched (H-2) — no need for fire-and-forget user lookup.
  sendStationApprovalEmail(stationUser.email, station.name, locale, { qrPublicUrl })
    .catch((e) => console.error('[APPROVE_EMAIL_FAILED]', { stationId, error: e instanceof Error ? e.message : String(e) }));

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
  const station = await findStationById(stationId);
  if (!station) throw new NotFoundError('Station not found');

  // H-2: Fail hard — an orphaned station should not be silently rejected without notifying anyone.
  const stationUser = station.user_id ? await findById(station.user_id) : null;
  if (!stationUser) {
    throw new NotFoundError('Station owner not found — cannot reject an orphaned station');
  }

  // C-2 + H-1: Atomic conditional UPDATE + audit log in one transaction.
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(stations)
      .set({
        status: 'rejected',
        rejection_reason: reason,
        rejection_count: (station.rejection_count ?? 0) + 1,
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
    .catch((e) => console.error('[REJECT_EMAIL_FAILED]', { stationId, error: e instanceof Error ? e.message : String(e) }));
}


// %%%%% END - Admin station management %%%%%


// %%%%% Station owner (my station) %%%%%

/**
 * Returns the station associated with the given user id, with its documents.
 * Throws NotFoundError if no station is linked to this account.
 */
export async function getMyStation(userId: string): Promise<StationWithDocuments> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const documents = await findDocumentsByStationId(station.id);
  return { ...station, documents };
}

/**
 * Partially updates the profile fields of the station owned by the given user.
 * Only provided fields are updated; omitted fields are left unchanged.
 * Throws NotFoundError if no station is linked to this account.
 */
export async function updateMyStation(
  userId: string,
  data: {
    name?: string;
    description?: string | null;
    address?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
    service_scope?: 'exterior' | 'interior' | 'both' | null;
    wash_post_count?: number;
  }
): Promise<Station> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const payload: Parameters<typeof updateStationInfo>[1] = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.description !== undefined) payload.description = data.description;
  if (data.address !== undefined) payload.address = data.address;
  if (data.city !== undefined) payload.city = data.city;
  if (data.latitude !== undefined) payload.latitude = data.latitude != null ? String(data.latitude) : null;
  if (data.longitude !== undefined) payload.longitude = data.longitude != null ? String(data.longitude) : null;
  if (data.service_scope !== undefined) payload.service_scope = data.service_scope;
  if (data.wash_post_count !== undefined) payload.wash_post_count = data.wash_post_count;

  const updated = await updateStationInfo(station.id, payload);
  if (!updated) throw new NotFoundError('No station associated with this account');
  return updated;
}

/**
 * Replaces all station photos (documents with document_type = 'photo') for the station
 * owned by the given user. Existing photos are deleted and new ones are inserted atomically.
 * Throws NotFoundError if no station is linked to this account.
 */
export async function updateMyStationPhotos(
  userId: string,
  photoUrls: string[]
): Promise<string[]> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const inserted = await db.transaction(async (tx) => {
    await tx
      .delete(stationDocuments)
      .where(
        and(
          eq(stationDocuments.station_id, station.id),
          eq(stationDocuments.document_type, 'photo')
        )
      );

    return tx.insert(stationDocuments).values(
      photoUrls.map((url) => ({
        station_id: station.id,
        document_type: 'photo',
        file_url: url,
        storage: 'cloudinary' as const,
        terms_accepted: true,
      }))
    ).returning();
  });

  return inserted.map((row) => row.file_url);
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
 * Returns paginated list of active stations and optional group arrays
 * (available_now, most_appreciated, most_visited).
 *
 * Response shape: { data: { all, ...groups }, meta: { total, page, per_page, total_pages } }.
 * Backward compatible: when no groups param, only data.all and meta are set.
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

  return {
    data,
    meta: { total, page, per_page, total_pages },
  };
}

/**
 * Returns a single active station with config, vehicle formats, and time slots.
 * Includes available and available_slots computed from timeSlots (start_time > NOW()).
 * Includes completed_count (Services terminés) from reservations with completed_at IS NOT NULL.
 * Throws NotFoundError if station does not exist or is not active.
 */
export async function getStationDetailPublic(id: string) {
  const station = await findActiveStationWithDetail(id);
  if (!station) throw new NotFoundError('Station not found');

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
 * "Client en route": builds Google Maps URL for an active station from lat/lng or address.
 * Throws NotFoundError if station does not exist or is not active.
 */
export async function getStationJoinPublic(id: string): Promise<{ mapsUrl: string }> {
  const station = await findStationById(id);
  if (!station || station.status !== 'active') throw new NotFoundError('Station not found');

  const lat = station.latitude != null ? String(station.latitude) : null;
  const lng = station.longitude != null ? String(station.longitude) : null;
  const q =
    lat != null && lng != null
      ? encodeURIComponent(`${lat},${lng}`)
      : encodeURIComponent([station.address, station.city].filter(Boolean).join(', '));
  const mapsUrl = `https://www.google.com/maps?q=${q}`;
  return { mapsUrl };
}


// %%%%% END - Public API (Card 1) %%%%%
