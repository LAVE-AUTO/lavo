/**
 * Unit tests for station upload-service: validateStationDocumentFile and upload flow.
 * Mocks Cloudinary and fs to test validation and Cloudinary vs local fallback.
 */
import { ValidationError } from '@/lib/errors';
import { STATION_DOC_MAX_SIZE } from '@/helpers/constants';

const mockUploadStreamEnd = jest.fn();
const mockUploadStream = jest.fn((callback: (err: Error | null, res?: { secure_url?: string }) => void, _opts: unknown) => ({
  end: (buffer: Buffer) => mockUploadStreamEnd(buffer, callback),
}));

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: mockUploadStream,
    },
  },
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

// Clear env so Cloudinary is skipped unless we set it in tests
const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
});

afterAll(() => {
  process.env = originalEnv;
});

import {
  validateStationDocumentFile,
  uploadStationDocument,
} from '@/server/station/upload-service';

describe('upload-service', () => {
  describe('validateStationDocumentFile', () => {
    it('accepts image types within size limit', () => {
      expect(() =>
        validateStationDocumentFile({ type: 'image/jpeg', size: 1024 })
      ).not.toThrow();
      expect(() =>
        validateStationDocumentFile({ type: 'image/png', size: 1024 })
      ).not.toThrow();
      expect(() =>
        validateStationDocumentFile({ type: 'image/webp', size: 1024 })
      ).not.toThrow();
      expect(() =>
        validateStationDocumentFile({ type: 'image/gif', size: 1024 })
      ).not.toThrow();
    });

    it('accepts PDF within size limit', () => {
      expect(() =>
        validateStationDocumentFile({
          type: 'application/pdf',
          size: STATION_DOC_MAX_SIZE - 1,
        })
      ).not.toThrow();
    });

    it('accepts file at exactly max size', () => {
      expect(() =>
        validateStationDocumentFile({
          type: 'image/jpeg',
          size: STATION_DOC_MAX_SIZE,
        })
      ).not.toThrow();
    });

    it('rejects oversized file', () => {
      expect(() =>
        validateStationDocumentFile({
          type: 'image/jpeg',
          size: STATION_DOC_MAX_SIZE + 1,
        })
      ).toThrow(ValidationError);
      expect(() =>
        validateStationDocumentFile({
          type: 'application/pdf',
          size: STATION_DOC_MAX_SIZE + 1,
        })
      ).toThrow(ValidationError);
    });

    it('rejects disallowed type', () => {
      expect(() =>
        validateStationDocumentFile({ type: 'text/plain', size: 1024 })
      ).toThrow(ValidationError);
      expect(() =>
        validateStationDocumentFile({ type: 'application/zip', size: 1024 })
      ).toThrow(ValidationError);
      expect(() =>
        validateStationDocumentFile({ type: 'image/svg+xml', size: 1024 })
      ).toThrow(ValidationError);
    });
  });

  describe('uploadStationDocument', () => {
    const createFile = (overrides: Partial<{ type: string; name: string }> = {}) => ({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      type: 'image/jpeg',
      name: 'test.jpg',
      ...overrides,
    });

    it('returns cloudinary result when env set and upload succeeds', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'cloud';
      process.env.CLOUDINARY_API_KEY = 'key';
      process.env.CLOUDINARY_API_SECRET = 'secret';

      mockUploadStreamEnd.mockImplementation(
        (_buffer: Buffer, callback: (err: null, res?: { secure_url: string }) => void) => {
          callback(null, { secure_url: 'https://res.cloudinary.com/test/image/upload/v1/abc.jpg' });
        }
      );

      const file = createFile();
      const result = await uploadStationDocument(file);

      expect(result.storage).toBe('cloudinary');
      expect(result.file_url).toContain('cloudinary.com');
      const { mkdir, writeFile } = await import('fs/promises');
      expect(mkdir).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('writes to local and returns local when Cloudinary env missing', async () => {
      const file = createFile();
      const result = await uploadStationDocument(file);

      expect(result.storage).toBe('local');
      expect(result.file_url).toBeDefined();
      const { mkdir, writeFile } = await import('fs/promises');
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
    });

    it('writes to local when Cloudinary upload fails', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'cloud';
      process.env.CLOUDINARY_API_KEY = 'key';
      process.env.CLOUDINARY_API_SECRET = 'secret';

      mockUploadStreamEnd.mockImplementation(
        (callback: (err: Error) => void) => {
          callback(new Error('Network error'));
        }
      );

      const file = createFile();
      const result = await uploadStationDocument(file);

      expect(result.storage).toBe('local');
      expect(result.file_url).toBeDefined();
      const { writeFile } = await import('fs/promises');
      expect(writeFile).toHaveBeenCalled();
    });

    it('writes to local when Cloudinary returns no secure_url', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'cloud';
      process.env.CLOUDINARY_API_KEY = 'key';
      process.env.CLOUDINARY_API_SECRET = 'secret';

      mockUploadStreamEnd.mockImplementation(
        (callback: (err: null, res?: { secure_url?: string }) => void) => {
          callback(null, {});
        }
      );

      const file = createFile();
      const result = await uploadStationDocument(file);

      expect(result.storage).toBe('local');
      expect(result.file_url).toBeDefined();
      const { writeFile } = await import('fs/promises');
      expect(writeFile).toHaveBeenCalled();
    });
  });
});
