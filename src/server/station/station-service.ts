import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
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
import { insertAdminLog } from '@/server/admin/admin-log-repository';
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
  updateStationInfo,
  updateStationStatus,
  type ListActiveStationsFilters,
  type Station,
  type StationWithAvailableSlots,
} from './station-repository';
import { findDocumentsByStationId } from './document-repository';

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

export type PendingStationsResult = {
  stations: Station[];
  meta: PendingStationsMeta;
};

export async function getPendingStations(page = 1, perPage = 20): Promise<PendingStationsResult> {
  const { rows, total } = await listStationsByStatus('pending_admin_validation', page, perPage);
  return {
    stations: rows,
    meta: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}

export async function getStationById(id: string): Promise<StationWithDocuments> {
  const station = await findStationById(id);
  if (!station) throw new NotFoundError('Station not found');

  const documents = await findDocumentsByStationId(id);
  return { ...station, documents };
}

export async function approveStation(
  adminId: string,
  stationId: string
): Promise<void> {
  const station = await findStationById(stationId);
  if (!station) throw new NotFoundError('Station not found');

  if (station.status !== 'pending_admin_validation') {
    throw new ConflictError('Station is not pending validation');
  }

  // Fetch station user upfront — needed for Stripe account creation and approval email.
  const stationUser = station.user_id ? await findById(station.user_id) : null;
  if (!stationUser) {
    console.warn('[APPROVE_NO_USER]', { stationId, user_id: station.user_id });
  }

  // Activate station.
  await updateStationStatus(stationId, 'active', {
    approved_by: adminId,
    approved_at: new Date(),
  });

  // Create Stripe Connect Express account and store the account id — non-fatal.
  let stripeOnboardingUrl: string | null = null;
  if (stationUser) {
    try {
      const accountId = await createStripeConnectAccount(stationUser.email, stationId);
      await updateStationInfo(stationId, { stripe_account_id: accountId });
      stripeOnboardingUrl = await createStripeOnboardingLink(accountId);
    } catch (e) {
      console.error('[APPROVE_STRIPE_CONNECT_FAILED]', {
        stationId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Admin audit log — non-fatal.
  try {
    await insertAdminLog({
      admin_id: adminId,
      action: 'station_approved',
      target_type: 'station',
      target_id: stationId,
      details: { stripe_connected: stripeOnboardingUrl !== null },
    });
  } catch (e) {
    console.error('[APPROVE_ADMIN_LOG_FAILED]', {
      stationId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Approval email — fire-and-forget.
  if (stationUser) {
    sendStationApprovalEmail(stationUser.email, station.name, stripeOnboardingUrl ?? undefined)
      .catch(() => void 0);
  }
}

export async function rejectStation(
  adminId: string,
  stationId: string,
  reason: string
): Promise<void> {
  const station = await findStationById(stationId);
  if (!station) throw new NotFoundError('Station not found');

  if (station.status !== 'pending_admin_validation') {
    throw new ConflictError('Station is not pending validation');
  }

  // Fetch station user upfront — needed for rejection email.
  const stationUser = station.user_id ? await findById(station.user_id) : null;
  if (!stationUser) {
    console.warn('[REJECT_NO_USER]', { stationId, user_id: station.user_id });
  }

  await updateStationStatus(stationId, 'rejected', { rejection_reason: reason });

  // Admin audit log — non-fatal.
  try {
    await insertAdminLog({
      admin_id: adminId,
      action: 'station_rejected',
      target_type: 'station',
      target_id: stationId,
      details: { reason },
    });
  } catch (e) {
    console.error('[REJECT_ADMIN_LOG_FAILED]', {
      stationId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Rejection email — fire-and-forget.
  if (stationUser) {
    sendStationRejectionEmail(stationUser.email, station.name, reason).catch(() => void 0);
  }
}

export async function getMyStation(userId: string): Promise<StationWithDocuments> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const documents = await findDocumentsByStationId(station.id);
  return { ...station, documents };
}

// ─── Public API (Card 1) ────────────────────────────────────────────────────

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
 * Returns paginated list of active stations and optional group arrays (available_now, most_appreciated, most_visited).
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
  const completed_count = await getCompletedCountForStation(id);
  return { ...station, available_slots, available, completed_count };
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

