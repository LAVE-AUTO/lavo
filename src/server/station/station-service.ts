import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { users, emailVerificationTokens, stations, stationDocuments } from '@/lib/db/schema';
import { sendVerificationEmail } from '@/lib/email';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { findByEmail, type SafeUser } from '@/server/auth/user-repository';
import {
  findStationById,
  findStationByUserId,
  listStationsByStatus,
  updateStationStatus,
  type Station,
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
  // Step 3 — documents + legal
  documents: { document_type: string; file_url: string }[];
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
  dto: StationOnboardingDto
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

    await tx.insert(stationDocuments).values(
      dto.documents.map((d) => ({
        station_id: newStation.id,
        document_type: d.document_type,
        file_url: d.file_url,
        terms_accepted: dto.terms_accepted,
      }))
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _, ...safeUser } = newUser;
    return { user: safeUser as SafeUser, station: newStation };
  });

  // Fire-and-forget
  sendVerificationEmail(user.email, user.email, verificationToken).catch(() => void 0);

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
