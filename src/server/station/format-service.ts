/**
 * Business logic for vehicle formats. Global catalog — no station scoping.
 */
import {
  findAllFormats,
  findFormatsPaginated,
  findFormatById,
  createFormat as repoCreateFormat,
  updateFormat as repoUpdateFormat,
  countReservationsByFormatId,
  deleteFormatById,
  type CreateFormatData,
  type UpdateFormatData,
  type VehicleFormat,
} from './format-repository';
import { ConflictError, NotFoundError } from '@/lib/errors';

export async function getAllFormats(): Promise<VehicleFormat[]> {
  return findAllFormats();
}

export async function getFormatsPaginated(page: number, perPage: number): Promise<{ items: VehicleFormat[]; total: number }> {
  return findFormatsPaginated(page, perPage);
}

export type CreateFormatDto = {
  label: string;
  price: number;
  is_active?: boolean;
};

export async function createFormat(dto: CreateFormatDto): Promise<VehicleFormat> {
  const data: CreateFormatData = {
    label: dto.label,
    price: String(dto.price),
    is_active: dto.is_active ?? true,
  };
  return repoCreateFormat(data);
}

export type UpdateFormatDto = {
  label?: string;
  price?: number;
  is_active?: boolean;
};

export async function updateFormat(
  formatId: string,
  dto: UpdateFormatDto,
  partial: boolean
): Promise<VehicleFormat> {
  const format = await findFormatById(formatId);
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

export async function deleteFormat(formatId: string): Promise<void> {
  const format = await findFormatById(formatId);
  if (!format) throw new NotFoundError('Format not found');
  const count = await countReservationsByFormatId(format.id);
  if (count > 0) {
    throw new ConflictError('Cannot delete format that has reservations');
  }
  await deleteFormatById(format.id);
}
