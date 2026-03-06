/**
 * Unit tests for document-repository: pending_uploads and document storage.
 * Mocks db to assert insert, getPendingUploadsBatch, updateDocumentStorage, deletePendingUploadById.
 */
const mockFindManyPending = jest.fn().mockResolvedValue([]);
const mockFindManyStationDocs = jest.fn().mockResolvedValue([]);
const mockInsertValues = jest.fn().mockResolvedValue(undefined);
const mockUpdateWhere = jest.fn().mockResolvedValue(undefined);
const mockDeleteWhere = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/db', () => ({
  db: {
    insert: jest.fn().mockReturnValue({
      values: (...args: unknown[]) => mockInsertValues(...args),
    }),
    query: {
      stationDocuments: {
        findFirst: jest.fn().mockResolvedValue(undefined),
        findMany: (...args: unknown[]) => mockFindManyStationDocs(...args),
      },
      pendingUploads: {
        findMany: (...args: unknown[]) => mockFindManyPending(...args),
      },
    },
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: (...args: unknown[]) => mockUpdateWhere(...args),
      }),
    }),
    delete: jest.fn().mockReturnValue({
      where: (...args: unknown[]) => mockDeleteWhere(...args),
    }),
  },
}));

import {
  insertPendingUpload,
  getPendingUploadsBatch,
  findDocumentsByIds,
  updateDocumentStorage,
  deletePendingUploadById,
} from '@/server/station/document-repository';
import { db } from '@/lib/db';

describe('document-repository (pending_uploads)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('insertPendingUpload', () => {
    it('inserts a row with station_document_id', async () => {
      const docId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      await insertPendingUpload(docId);
      expect(db.insert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith({
        station_document_id: docId,
      });
    });
  });

  describe('findDocumentsByIds', () => {
    it('returns empty array when ids is empty', async () => {
      const result = await findDocumentsByIds([]);
      expect(result).toEqual([]);
      expect(mockFindManyStationDocs).not.toHaveBeenCalled();
    });

    it('returns docs from findMany when ids provided', async () => {
      const docs = [
        { id: 'd1', station_id: 's1', file_url: 'url1', storage: 'local' },
      ];
      mockFindManyStationDocs.mockResolvedValueOnce(docs);
      const result = await findDocumentsByIds(['d1', 'd2']);
      expect(result).toEqual(docs);
      expect(mockFindManyStationDocs).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });
  });

  describe('getPendingUploadsBatch', () => {
    it('returns batch from findMany with orderBy and limit', async () => {
      const batch = [
        {
          id: 'p1',
          station_document_id: 'd1',
          created_at: new Date(),
        },
      ];
      mockFindManyPending.mockResolvedValueOnce(batch);
      const result = await getPendingUploadsBatch(10);
      expect(result).toEqual(batch);
      expect(mockFindManyPending).toHaveBeenCalledWith({
        orderBy: expect.anything(),
        limit: 10,
      });
    });
  });

  describe('updateDocumentStorage', () => {
    it('updates station document file_url and storage', async () => {
      await updateDocumentStorage(
        'doc-id',
        'https://res.cloudinary.com/example/upload/v1/xyz.pdf',
        'cloudinary'
      );
      expect(db.update).toHaveBeenCalled();
      expect(mockUpdateWhere).toHaveBeenCalled();
    });
  });

  describe('deletePendingUploadById', () => {
    it('deletes pending_uploads row by id', async () => {
      await deletePendingUploadById('pending-id');
      expect(db.delete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });
  });
});
