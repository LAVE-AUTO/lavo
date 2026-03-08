import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import {
  pendingUploads,
  users,
  emailVerificationTokens,
  stations,
  stationDocuments,
} from '@/lib/db/schema';
import {
  sendVerificationEmail,
  sendStationApprovalEmail,
  sendStationApplicationAdminNotification,
} from '@/lib/email';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors';
import { findByEmail, findById, type SafeUser } from '@/server/auth/user-repository';
import {
  findStationById,
  findStationByUserId,
  findActiveStationWithDetail,
  listActiveStations,
  listStationsByStatus,
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
  wash_type: 'hand_wash' | 'automatic' | 'self_service';
  description?: string;
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

  const { user, station } = await db.transaction(async (tx) => {
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
        wash_type: dto.wash_type,
        description: dto.description,
        wash_post_count: dto.wash_post_count,
        status: 'pending_admin_validation',
      })
      .returning();

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

export async function getPendingStations(): Promise<Station[]> {
  return listStationsByStatus('pending_admin_validation');
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
    throw new ForbiddenError('Station is not pending validation');
  }

  await updateStationStatus(stationId, 'active', {
    approved_by: adminId,
    approved_at: new Date(),
  });

  // Fire-and-forget — only possible if station has an associated user account (3-step flow)
  if (station.user_id) {
    findById(station.user_id).then((user) => {
      if (user) {
        sendStationApprovalEmail(user.email, station.name).catch(() => void 0);
      }
    }).catch(() => void 0);
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
    throw new ForbiddenError('Station is not pending validation');
  }

  void adminId; // logged implicitly via audit; extend with admin_logs table if needed
  await updateStationStatus(stationId, 'rejected', { rejection_reason: reason });
}

export async function getMyStation(userId: string): Promise<StationWithDocuments> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');

  const documents = await findDocumentsByStationId(station.id);
  return { ...station, documents };
}

// ─── Public API (Card 1) ────────────────────────────────────────────────────

/**
 * List item for GET /api/v1/stations. Station row plus available (derived from slots)
 * and available_slots (sum of capacity - booked_count for start_time > NOW()).
 * Unavailability is derived only from slot availability; no API toggle for is_open.
 * Figma shows Station ouverte/fermée toggles—backend does not expose them; front
 * should use available and available_slots.
 */
export type StationListPublicItem = Omit<StationWithAvailableSlots, 'available_slots'> & {
  available_slots: number;
  available: boolean;
};

/**
 * Returns list of active stations with optional search, city filter, and sort.
 * Each item includes available (true iff available_slots > 0) and available_slots.
 */
export async function listStationsPublic(
  filters: ListActiveStationsFilters
): Promise<StationListPublicItem[]> {
  const rows = await listActiveStations(filters);
  return rows.map((row) => {
    const available_slots = Math.max(0, Number(row.available_slots ?? 0));
    const available = available_slots > 0;
    const { available_slots: _raw, ...rest } = row;
    return { ...rest, available_slots, available };
  });
}

/**
 * Returns a single active station with config, vehicle formats, and time slots.
 * Includes available and available_slots computed from timeSlots (start_time > NOW()).
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
  return { ...station, available_slots, available };
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
      ? `${lat},${lng}`
      : encodeURIComponent([station.address, station.city].filter(Boolean).join(', '));
  const mapsUrl = `https://www.google.com/maps?q=${q}`;
  return { mapsUrl };
}

