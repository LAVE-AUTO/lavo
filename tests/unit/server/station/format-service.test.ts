/**
 * Unit tests for format-service: getFormatsByStationIdPublic, createFormat, updateFormat, deleteFormat.
 * Mocks station-repository and format-repository.
 */
const mockFindActiveStationWithDetail = jest.fn();
const mockFindStationByUserId = jest.fn();
const mockFindFormatsByStationId = jest.fn();
const mockFindFormatByIdAndStation = jest.fn();
const mockRepoCreateFormat = jest.fn();
const mockRepoUpdateFormat = jest.fn();
const mockCountReservationsByFormatId = jest.fn();
const mockDeleteFormatById = jest.fn();

jest.mock('@/server/station/station-repository', () => ({
  findActiveStationWithDetail: (...args: unknown[]) => mockFindActiveStationWithDetail(...args),
  findStationByUserId: (...args: unknown[]) => mockFindStationByUserId(...args),
}));

jest.mock('@/server/station/format-repository', () => ({
  findFormatsByStationId: (...args: unknown[]) => mockFindFormatsByStationId(...args),
  findFormatByIdAndStation: (...args: unknown[]) => mockFindFormatByIdAndStation(...args),
  createFormat: (...args: unknown[]) => mockRepoCreateFormat(...args),
  updateFormat: (...args: unknown[]) => mockRepoUpdateFormat(...args),
  countReservationsByFormatId: (...args: unknown[]) => mockCountReservationsByFormatId(...args),
  deleteFormatById: (...args: unknown[]) => mockDeleteFormatById(...args),
}));

import {
  getFormatsByStationIdPublic,
  createFormat,
  updateFormat,
  deleteFormat,
} from '@/server/station/format-service';
import { NotFoundError, ConflictError } from '@/lib/errors';

const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const formatId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const userId = 'user-uuid';

describe('format-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFormatsByStationIdPublic', () => {
    it('returns formats when station is active', async () => {
      mockFindActiveStationWithDetail.mockResolvedValue({ id: stationId });
      const formats = [
        { id: formatId, station_id: stationId, label: 'SUV', price: '25.00', is_active: true },
      ] as any;
      mockFindFormatsByStationId.mockResolvedValue(formats);

      const result = await getFormatsByStationIdPublic(stationId);
      expect(result).toEqual(formats);
      expect(mockFindActiveStationWithDetail).toHaveBeenCalledWith(stationId);
      expect(mockFindFormatsByStationId).toHaveBeenCalledWith(stationId);
    });

    it('throws NotFoundError when station not found or not active', async () => {
      mockFindActiveStationWithDetail.mockResolvedValue(undefined);
      await expect(getFormatsByStationIdPublic(stationId)).rejects.toThrow(NotFoundError);
      expect(mockFindFormatsByStationId).not.toHaveBeenCalled();
    });
  });

  describe('createFormat', () => {
    it('creates format for station owned by user', async () => {
      mockFindStationByUserId.mockResolvedValue({ id: stationId });
      const created = {
        id: formatId,
        station_id: stationId,
        label: 'Moyen',
        price: '15.00',
        is_active: true,
      } as any;
      mockRepoCreateFormat.mockResolvedValue(created);

      const result = await createFormat(userId, { label: 'Moyen', price: 15 });
      expect(result).toEqual(created);
      expect(mockRepoCreateFormat).toHaveBeenCalledWith(stationId, {
        label: 'Moyen',
        price: '15',
        is_active: true,
      });
    });

    it('uses provided is_active when given', async () => {
      mockFindStationByUserId.mockResolvedValue({ id: stationId });
      mockRepoCreateFormat.mockResolvedValue({} as any);
      await createFormat(userId, { label: 'X', price: 10, is_active: false });
      expect(mockRepoCreateFormat).toHaveBeenCalledWith(stationId, {
        label: 'X',
        price: '10',
        is_active: false,
      });
    });

    it('throws NotFoundError when no station for user', async () => {
      mockFindStationByUserId.mockResolvedValue(undefined);
      await expect(createFormat(userId, { label: 'X', price: 10 })).rejects.toThrow(NotFoundError);
      expect(mockRepoCreateFormat).not.toHaveBeenCalled();
    });
  });

  describe('updateFormat', () => {
    it('updates format (full) when format belongs to station', async () => {
      mockFindStationByUserId.mockResolvedValue({ id: stationId });
      const existing = { id: formatId, station_id: stationId } as any;
      mockFindFormatByIdAndStation.mockResolvedValue(existing);
      const updated = { ...existing, label: 'SUV', price: '30.00', is_active: false };
      mockRepoUpdateFormat.mockResolvedValue(updated);

      const result = await updateFormat(
        userId,
        formatId,
        { label: 'SUV', price: 30, is_active: false },
        false
      );
      expect(result).toEqual(updated);
      expect(mockRepoUpdateFormat).toHaveBeenCalledWith(formatId, {
        label: 'SUV',
        price: '30',
        is_active: false,
      });
    });

    it('updates format (partial) with only provided fields', async () => {
      mockFindStationByUserId.mockResolvedValue({ id: stationId });
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId } as any);
      mockRepoUpdateFormat.mockResolvedValue({ id: formatId, price: '20.00' } as any);

      await updateFormat(userId, formatId, { price: 20 }, true);
      expect(mockRepoUpdateFormat).toHaveBeenCalledWith(formatId, { price: '20' });
    });

    it('throws NotFoundError when format not found or wrong station', async () => {
      mockFindStationByUserId.mockResolvedValue({ id: stationId });
      mockFindFormatByIdAndStation.mockResolvedValue(undefined);
      await expect(
        updateFormat(userId, formatId, { label: 'X', price: 1, is_active: true }, false)
      ).rejects.toThrow(NotFoundError);
      expect(mockRepoUpdateFormat).not.toHaveBeenCalled();
    });
  });

  describe('deleteFormat', () => {
    it('deletes format when no reservations', async () => {
      mockFindStationByUserId.mockResolvedValue({ id: stationId });
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId } as any);
      mockCountReservationsByFormatId.mockResolvedValue(0);
      mockDeleteFormatById.mockResolvedValue(undefined);

      await deleteFormat(userId, formatId);
      expect(mockCountReservationsByFormatId).toHaveBeenCalledWith(formatId);
      expect(mockDeleteFormatById).toHaveBeenCalledWith(formatId);
    });

    it('throws ConflictError when format has reservations', async () => {
      mockFindStationByUserId.mockResolvedValue({ id: stationId });
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId } as any);
      mockCountReservationsByFormatId.mockResolvedValue(3);

      await expect(deleteFormat(userId, formatId)).rejects.toThrow(ConflictError);
      expect(mockDeleteFormatById).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when format not found', async () => {
      mockFindStationByUserId.mockResolvedValue({ id: stationId });
      mockFindFormatByIdAndStation.mockResolvedValue(undefined);
      await expect(deleteFormat(userId, formatId)).rejects.toThrow(NotFoundError);
      expect(mockCountReservationsByFormatId).not.toHaveBeenCalled();
      expect(mockDeleteFormatById).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when no station for user', async () => {
      mockFindStationByUserId.mockResolvedValue(undefined);
      await expect(deleteFormat(userId, formatId)).rejects.toThrow(NotFoundError);
      expect(mockFindFormatByIdAndStation).not.toHaveBeenCalled();
      expect(mockDeleteFormatById).not.toHaveBeenCalled();
    });
  });
});
