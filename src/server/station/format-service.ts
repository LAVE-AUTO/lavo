/**
 * Business logic for vehicle formats. Global catalog — no station scoping.
 */
import {
  findAllFormats,
  findFormatsPaginated,
  findFormatById,
  findFormatByNormalizedLabel,
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
 * Canonical label form used both for the application-level uniqueness
 * check and for storage. Collapses runs of whitespace and trims so
 * "SUV", " SUV ", "SUV  " all map to the same stored value, which then
 * the case-insensitive unique index keys on.
 */
function normalizeLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

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
  const label = normalizeLabel(dto.label);
  if (!label) throw new ConflictError('Format label cannot be empty');
  /* Catch the duplicate in the application layer so the merchant sees
   * 'Ce format existe déjà' instead of a raw 23505 unique violation
   * from Postgres. The DB index added in migration 0049 is the
   * definitive guard against races. */
  const existing = await findFormatByNormalizedLabel(label);
  if (existing) {
    throw new ConflictError('A vehicle format with this label already exists');
  }
  const data: CreateFormatData = {
    label,
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

  /* If the label is changing, normalize and verify uniqueness against
   * every other row before persisting. The row we're editing itself is
   * excluded so callers can save with no label change. */
  let nextLabel: string | undefined;
  if (dto.label !== undefined) {
    nextLabel = normalizeLabel(dto.label);
    if (!nextLabel) throw new ConflictError('Format label cannot be empty');
    const collision = await findFormatByNormalizedLabel(nextLabel, format.id);
    if (collision) {
      throw new ConflictError('A vehicle format with this label already exists');
    }
  }

  const data: UpdateFormatData = {};
  if (nextLabel !== undefined) data.label = nextLabel;
  if (dto.price !== undefined) data.price = String(dto.price);
  if (dto.is_active !== undefined) data.is_active = dto.is_active;
  const payload = partial
    ? data
    : {
        label: nextLabel ?? format.label,
        price: String(dto.price!),
        is_active: dto.is_active!,
      };
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
