import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getCachedOrFetch } from '@/lib/redis-cache';
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
import {
  findDocumentsByStationId,
  findPhotosByStationId,
  replaceStationPhotos,
  type StationPhoto,
} from './document-repository';
import { findAllFormats } from './format-repository';
import { findPublicServicesForStation } from './service-repository';
import { getStationHours } from './station-hours-service';

export type StationOnboardingDto = {
  // Step 1 - account credentials
  email: string;
  phone: string;
  password: string;
  // Step 2 - station details
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
  // Step 3 - documents + legal (storage from onboarding upload; default cloudinary)
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

    for (const row of docRows) {
      if (row.storage === 'local') {
        await tx.insert(pendingUploads).values({
          station_document_id: row.id,
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _, ...safeUser } = newUser;
    return { user: safeUser as SafeUser, station: newStation };
  });

  // Fire-and-forget (station accounts have no first_name; use station name for greeting)
  sendVerificationEmail(user.email, dto.station_name ?? '', verificationToken, locale).catch(() => void 0);

  sendStationApplicationAdminNotification(station.name, station.id).catch(() => void 0);

  return { user, station };
}

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

export async function getStationsForAdmin(status?: string): Promise<Station[]> {
  const rows = await listAllStationsForAdmin(status);
  // Ensure DB numeric/decimal types are converted to JSON-serializable primitives
  return rows.map((r) => ({
    ...r,
    promo_commission_rate: r.promo_commission_rate == null ? null : String(r.promo_commission_rate),
    latitude: r.latitude == null ? null : String(r.latitude),
    longitude: r.longitude == null ? null : String(r.longitude),
    average_score: r.average_score == null ? null : String(r.average_score),
  } as Station));
}

export async function getStationById(id: string): Promise<StationWithDocuments> {
  const station = await findStationById(id);
  if (!station) throw new NotFoundError('Station not found');

  const [documents, photos] = await Promise.all([
    findDocumentsByStationId(id),
    findPhotosByStationId(id),
  ]);
  return { ...station, documents, photos };
}

export async function approveStation(
  adminId: string,
  stationId: string,
  locale: 'fr' | 'en' = 'fr',
  documentExpiryDates?: Array<{ document_id: string; expiry_date: Date }>
): Promise<void> {
  const station = await findStationById(stationId);
  if (!station) throw new NotFoundError('Station not found');

  // H-2: Fail hard - a station without an owner cannot be activated or receive payments.
  const stationUser = station.user_id ? await findById(station.user_id) : null;
  if (!stationUser) {
    throw new NotFoundError('Station owner not found - cannot approve an orphaned station');
  }

  // M-1: Create Stripe account BEFORE activating so the station stays pending if Stripe fails.
  const accountId = await createStripeConnectAccount(stationUser.email, stationId);
  const stripeOnboardingUrl = await createStripeOnboardingLink(accountId);

  // C-2 + H-1: Atomic conditional UPDATE + audit log in one transaction.
  // The WHERE on status ensures only one concurrent approve wins - the other gets 0 rows → 409.
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

    // Persist document expiry dates if provided - rows are independent, run in parallel.
    if (documentExpiryDates?.length) {
      const ownedIds = await tx
        .select({ id: stationDocuments.id })
        .from(stationDocuments)
        .where(eq(stationDocuments.station_id, stationId));
      const ownedSet = new Set(ownedIds.map((r) => r.id));
      await Promise.all(
        documentExpiryDates
          .filter(({ document_id }) => ownedSet.has(document_id))
          .map(({ document_id, expiry_date }) =>
            tx
              .update(stationDocuments)
              .set({ expiry_date })
              .where(eq(stationDocuments.id, document_id))
          )
      );
    }
  });

  let qrPublicUrl: string | undefined;
  try {
    qrPublicUrl = buildStationQrPublicUrl({ origin: APP_URL, locale, stationId: station.id });
  } catch (e) {
    console.error('[STATION_APPROVAL_QR_URL_GENERATION_FAILED]', { stationId, error: e instanceof Error ? e.message : String(e) });
  }

  // M-4: stationUser already fetched (H-2) - no need for fire-and-forget user lookup.
  sendStationApprovalEmail(stationUser.email, station.name, locale, { qrPublicUrl })
    .catch((e) => console.error('[APPROVE_EMAIL_FAILED]', { stationId, error: e instanceof Error ? e.message : String(e) }));

  sendStationApplicationAdminNotification(station.name, station.id, { context: 'approval', qrPublicUrl })
    .catch(() => void 0);
}

export async function rejectStation(
  adminId: string,
  stationId: string,
  reason: string
): Promise<void> {
  const station = await findStationById(stationId);
  if (!station) throw new NotFoundError('Station not found');

  // H-2: Fail hard - an orphaned station should not be silently rejected without notifying anyone.
  const stationUser = station.user_id ? await findById(station.user_id) : null;
  if (!stationUser) {
    throw new NotFoundError('Station owner not found - cannot reject an orphaned station');
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

  // M-4: Fire-and-forget email - log failures instead of silently swallowing them.
  sendStationRejectionEmail(stationUser.email, station.name, reason)
    .catch((e) => console.error('[REJECT_EMAIL_FAILED]', { stationId, error: e instanceof Error ? e.message : String(e) }));
}

export async function getMyStation(userId: string): Promise<StationWithDocuments> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const [documents, photos] = await Promise.all([
    findDocumentsByStationId(station.id),
    findPhotosByStationId(station.id),
  ]);
  return { ...station, documents, photos };
}

// ─── Public API (Card 1) ────────────────────────────────────────────────────

/**
 * List item for GET /api/v1/stations. Station row plus derived availability fields,
 * enriched with price_from, image_url, verified, queue_count, and opening_hours.
 */
export type StationListPublicItem = Omit<
  StationWithAvailableSlots,
  'available_slots' | 'completed_count' | 'live_queue_count' | 'opening_time' | 'closing_time'
> & {
  available_slots: number;
  available: boolean;
  verified: boolean;
  queue_count: number;
  opening_hours: { open: string; close: string } | null;
  completed_count?: number;
  min_duration: number | null;
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
 * Maps repository row to public list item.
 * Converts numeric strings, computes verified and opening_hours, renames live_queue_count to queue_count.
 */
function toListPublicItem(row: StationWithAvailableSlots): StationListPublicItem {
  const available_slots = Math.max(0, Number(row.available_slots ?? 0));
  const available = available_slots > 0;
  const completed_count = row.completed_count != null ? Number(row.completed_count) : undefined;
  const verified = row.approved_at !== null && row.status === 'active';
  const opening_hours =
    row.opening_time && row.closing_time
      ? { open: row.opening_time, close: row.closing_time }
      : null;
  const {
    available_slots: _s,
    completed_count: _c,
    live_queue_count: _q,
    opening_time: _ot,
    closing_time: _ct,
    ...rest
  } = row;
  return {
    ...rest,
    available_slots,
    available,
    verified,
    queue_count: row.live_queue_count,
    opening_hours,
    min_duration: row.min_duration,
    ...(completed_count !== undefined && { completed_count }),
  };
}

// %%%%% Station owner - profile update %%%%%

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

  let uniqueWashTypeIds: string[] | undefined;
  if (data.wash_types !== undefined) {
    uniqueWashTypeIds = [...new Set(data.wash_types)];
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

export async function updateMyStationPhotos(
  userId: string,
  photos: { url: string; position: number }[]
): Promise<StationPhoto[]> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('Station not found for this user');
  return replaceStationPhotos(station.id, photos);
}

// %%%%% END - Station owner - profile update %%%%%

/** Cache TTL in seconds for public station listing (Redis layer). */
const STATIONS_LIST_TTL = 30;

/** In-process TTL for the station listing - avoids a Redis GET on every request. */
const STATIONS_LIST_INPROCESS_TTL_MS = 10_000;
const _stationsListCache = new Map<string, { value: ListStationsPublicResult; expiresAt: number }>();

/**
 * Returns paginated list of active stations and optional group arrays (available_now, most_appreciated, most_visited).
 * Response shape: { data: { all, ...groups }, meta: { total, page, per_page, total_pages } }.
 * Backward compatible: when no groups param, only data.all and meta are set.
 * Three-layer cache: in-process (10s) → Redis (30s) → DB.
 */
export async function listStationsPublic(
  filters: ListActiveStationsFilters
): Promise<ListStationsPublicResult> {
  const cacheKey = `stations:list:${JSON.stringify(filters, Object.keys(filters).sort())}`;

  const inProcess = _stationsListCache.get(cacheKey);
  if (inProcess && Date.now() < inProcess.expiresAt) return inProcess.value;

  const result = await getCachedOrFetch(cacheKey, STATIONS_LIST_TTL, async () => {
    const page = Math.max(1, filters.page ?? 1);
    const per_page = Math.min(100, Math.max(1, filters.per_page ?? 20));
    const hasActiveFilter = !!(filters.search?.trim() || filters.city || filters.format_id || filters.wash_type_ids?.length || filters.service_scope);
    const open_today = !hasActiveFilter;
    const { rows, total } = await listActiveStations({ ...filters, page, per_page, open_today });
    const total_pages = Math.max(1, Math.ceil(total / per_page));

    const data: ListStationsPublicData = {
      all: rows.map(toListPublicItem),
    };

    const groups = filters.groups;
    const limitPerGroup = filters.limit_per_group ?? 50;
    if (groups?.length) {
      const groupPromises = groups.map((group) =>
        listActiveStationsGroup(group, { ...filters, open_today }, limitPerGroup).then((r) => r.map(toListPublicItem))
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
  });

  _stationsListCache.set(cacheKey, { value: result, expiresAt: Date.now() + STATIONS_LIST_INPROCESS_TTL_MS });
  return result;
}

/**
 * Returns a single active station with config, vehicle formats, time slots, photos, and wash types.
 * Includes available, available_slots, completed_count, verified, photos[], and wash_types[].
 * Throws NotFoundError if station does not exist or is not active.
 */
export async function getStationDetailPublic(id: string) {
  const [station, vehicleFormats, completed_count, stationServices, hourRows] = await Promise.all([
    findActiveStationWithDetail(id),
    findAllFormats(),
    getCompletedCountForStation(id),
    findPublicServicesForStation(id),
    getStationHours(id),
  ]);
  if (!station) throw new NotFoundError('Station not found');

  const now = new Date();
  const available_slots = (station.timeSlots ?? [])
    .filter((s: { start_time: Date }) => s.start_time > now)
    .reduce(
      (sum: number, s: { capacity: number; booked_count: number }) =>
        sum + Math.max(0, (s.capacity ?? 0) - (s.booked_count ?? 0)),
      0
    );
  const available = available_slots > 0;
  const verified = station.approved_at !== null && station.status === 'active';

  const photos = (station.photos ?? []).map((p) => p.url);
  const wash_types = (station.stationWashTypes ?? [])
    .filter((swt) => swt.washType !== null)
    .map((swt) => ({
      id: swt.washType!.id,
      code: swt.washType!.code,
      label: swt.washType!.label,
    }));

  const station_config = station.stationConfig
    ? {
        opening_time: station.stationConfig.opening_time,
        closing_time: station.stationConfig.closing_time,
        wash_duration_minutes: station.stationConfig.wash_duration_minutes,
        wash_post_count: station.stationConfig.wash_post_count,
        reservation_surcharge: station.stationConfig.reservation_surcharge
          ? parseFloat(String(station.stationConfig.reservation_surcharge))
          : null,
      }
    : null;

  const station_hours = hourRows.map((row) => ({
    day_of_week: row.day_of_week,
    is_open: row.is_open,
    morning_start: row.morning_start,
    morning_end: row.morning_end,
    afternoon_start: row.afternoon_start,
    afternoon_end: row.afternoon_end,
  }));

  const { photos: _p, stationWashTypes: _w, ...rest } = station;
  return {
    ...rest,
    available_slots,
    available,
    completed_count,
    verified,
    photos,
    wash_types,
    vehicleFormats,
    station_services: stationServices,
    station_config,
    station_hours,
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

