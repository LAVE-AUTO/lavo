/**
 * Business logic for vehicle formats and pricing. Public list by station; station-scoped create/update/delete.
 */
import { findActiveStationWithDetail, findStationByUserId } from './station-repository';
import {
  findFormatsByStationId,
  findFormatByIdAndStation,
  createFormat as repoCreateFormat,
  updateFormat as repoUpdateFormat,
  countReservationsByFormatId,
  deleteFormatById,
  type CreateFormatData,
  type UpdateFormatData,
  type VehicleFormat,
} from './format-repository';
import { ConflictError, NotFoundError } from '@/lib/errors';

/**
 * Returns formats for an active station. Throws NotFoundError if station does not exist or is not active.
 */
export async function getFormatsByStationIdPublic(stationId: string): Promise<VehicleFormat[]> {
  const station = await findActiveStationWithDetail(stationId);
  if (!station) throw new NotFoundError('Station not found');
  return findFormatsByStationId(stationId);
}

export type CreateFormatDto = {
  label: string;
  price: number;
  is_active?: boolean;
};

/**
 * Creates a vehicle format for the station associated with the given user. Throws NotFoundError if no station.
 */
export async function createFormat(
  userId: string,
  dto: CreateFormatDto
): Promise<VehicleFormat> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');
  const data: CreateFormatData = {
    label: dto.label,
    price: String(dto.price),
    is_active: dto.is_active ?? true,
  };
  return repoCreateFormat(station.id, data);
}

export type UpdateFormatDto = {
  label?: string;
  price?: number;
  is_active?: boolean;
};

/**
 * Updates a format (full or partial). Verifies format belongs to station owned by user.
 * Throws NotFoundError if station or format not found or not owned.
 */
export async function updateFormat(
  userId: string,
  formatId: string,
  dto: UpdateFormatDto,
  partial: boolean
): Promise<VehicleFormat> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');
  const format = await findFormatByIdAndStation(formatId, station.id);
  if (!format) throw new NotFoundError('Format not found');
  const data: UpdateFormatData = {};
  if (dto.label !== undefined) data.label = dto.label;
  if (dto.price !== undefined) data.price = String(dto.price);
  if (dto.is_active !== undefined) data.is_active = dto.is_active;
  const payload = partial
    ? data
    : { label: dto.label!, price: String(dto.price!), is_active: dto.is_active! };
  return repoUpdateFormat(format.id, payload);
}

/**
 * Deletes a format if it has no reservations. Verifies format belongs to station owned by user.
 * Throws NotFoundError if station or format not found. Throws ConflictError if format has reservations.
 */
export async function deleteFormat(userId: string, formatId: string): Promise<void> {
  const station = await findStationByUserId(userId);
  if (!station) throw new NotFoundError('No station associated with this account');
  const format = await findFormatByIdAndStation(formatId, station.id);
  if (!format) throw new NotFoundError('Format not found');
  const count = await countReservationsByFormatId(format.id);
  if (count > 0) {
    throw new ConflictError('Cannot delete format that has reservations');
  }
  await deleteFormatById(format.id);
}
