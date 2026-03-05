import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { sendVerificationEmail } from '@/lib/email';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import {
  createUser,
  findByEmail,
  type SafeUser,
} from '@/server/auth/user-repository';
import { createToken } from '@/server/auth/token-repository';
import {
  createStation,
  findStationById,
  findStationByUserId,
  listStationsByStatus,
  updateStationInfo,
  updateStationStatus,
  type Station,
} from './station-repository';
import { createDocuments, findDocumentsByStationId } from './document-repository';

export type RegisterStationDto = {
  email: string;
  phone: string;
  password: string;
};

export type StationInfoDto = {
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
};

export type StationDocumentsDto = {
  documents: { document_type: string; file_url: string }[];
  terms_accepted: true;
};

export type StationWithDocuments = Station & {
  documents: Awaited<ReturnType<typeof findDocumentsByStationId>>;
};

export async function registerStation(dto: RegisterStationDto): Promise<SafeUser> {
  const existing = await findByEmail(dto.email);
  if (existing) throw new ConflictError('Email already in use');

  const password_hash = await bcrypt.hash(dto.password, 12);

  const user = await createUser({
    email: dto.email,
    phone: dto.phone,
    password_hash,
    role: 'station',
    status: 'pending_verification',
    // first_name and last_name intentionally omitted for station accounts
  });

  const token = await createToken({
    user_id: user.id,
    token: randomUUID(),
    type: 'email_verification',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  // Fire-and-forget
  sendVerificationEmail(user.email, user.email, token.token).catch(() => void 0);

  return user;
}

export async function submitStationInfo(
  userId: string,
  dto: StationInfoDto
): Promise<Station> {
  // Only one station per user allowed
  const existing = await findStationByUserId(userId);
  if (existing) throw new ConflictError('Station info has already been submitted');

  return createStation({
    user_id: userId,
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
    status: 'pending_review',
  });
}

export async function submitStationDocuments(
  userId: string,
  dto: StationDocumentsDto
): Promise<Station> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('Station info not found — complete step 2 first');

  if (station.status !== 'pending_review') {
    throw new ForbiddenError('Documents have already been submitted for this station');
  }

  await createDocuments(station.id, dto.documents, dto.terms_accepted);
  await updateStationStatus(station.id, 'pending_admin_validation');

  return findStationById(station.id) as Promise<Station>;
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
