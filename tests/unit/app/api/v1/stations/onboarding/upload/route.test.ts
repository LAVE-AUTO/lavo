/**
 * API tests for POST /api/v1/stations/onboarding/upload.
 * Public, rate-limited, multipart file. Mocks upload-service and rate-limiter.
 * @jest-environment node
 */
const mockCheckRateLimit = jest.fn();
const mockRecordFailedAttempt = jest.fn();
const mockResetOnSuccess = jest.fn();
const mockValidateStationDocumentFile = jest.fn();
const mockUploadStationDocument = jest.fn();

jest.mock('@/lib/rate-limiter', () => ({
  normalizeRateLimitKey: (k: string) => k,
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordFailedAttempt: (...args: unknown[]) => mockRecordFailedAttempt(...args),
  resetOnSuccess: (...args: unknown[]) => mockResetOnSuccess(...args),
}));

jest.mock('@/server/station/upload-service', () => ({
  validateStationDocumentFile: (...args: unknown[]) =>
    mockValidateStationDocumentFile(...args),
  uploadStationDocument: (...args: unknown[]) =>
    mockUploadStationDocument(...args),
}));

const mockHeadersGet = jest.fn((key: string) =>
  key === 'x-forwarded-for' ? '192.168.1.1' : null
);
jest.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: mockHeadersGet }),
}));

import { ValidationError } from '@/lib/errors';
import { POST } from '@/app/api/v1/stations/onboarding/upload/route';

function buildRequestWithFile(options: {
  fieldName?: string;
  fileName?: string;
  type?: string;
  size?: number;
  content?: string;
}): Request {
  const {
    fieldName = 'file',
    fileName = 'test.jpg',
    type = 'image/jpeg',
    size = 1024,
    content = 'x',
  } = options;
  const formData = new FormData();
  const file = new File([content], fileName, { type });
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  formData.set(fieldName, file);
  return new Request('http://localhost/api/v1/stations/onboarding/upload', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/v1/stations/onboarding/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ blocked: false });
  });

  it('returns 201 with url and storage when file is valid', async () => {
    mockUploadStationDocument.mockResolvedValueOnce({
      file_url: '/uploads/abc.jpg',
      storage: 'local',
    });
    const req = buildRequestWithFile({});
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ url: '/uploads/abc.jpg', storage: 'local' });
    expect(mockValidateStationDocumentFile).toHaveBeenCalledTimes(1);
    expect(mockUploadStationDocument).toHaveBeenCalledTimes(1);
    expect(mockResetOnSuccess).toHaveBeenCalledWith('ip:192.168.1.1');
    expect(mockRecordFailedAttempt).not.toHaveBeenCalled();
  });

  it('returns 400 when file field is missing', async () => {
    const formData = new FormData();
    const req = new Request('http://localhost/api/v1/stations/onboarding/upload', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/missing.*file/i);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockValidateStationDocumentFile).not.toHaveBeenCalled();
    expect(mockUploadStationDocument).not.toHaveBeenCalled();
    expect(mockRecordFailedAttempt).toHaveBeenCalledWith('ip:192.168.1.1');
  });

  it('returns 400 when file field is not a File instance', async () => {
    const formData = new FormData();
    formData.set('file', 'not-a-file');
    const req = new Request('http://localhost/api/v1/stations/onboarding/upload', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/missing.*file/i);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it('returns 400 when file type is invalid', async () => {
    mockValidateStationDocumentFile.mockImplementationOnce(() => {
      throw new ValidationError(
        'Invalid file type. Allowed: images (JPEG, PNG, WebP, GIF) and PDF.'
      );
    });
    const req = buildRequestWithFile({ type: 'text/plain', fileName: 'x.txt' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUploadStationDocument).not.toHaveBeenCalled();
    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it('returns 413 when file is too large', async () => {
    mockValidateStationDocumentFile.mockImplementationOnce(() => {
      throw new ValidationError(
        'File too large. Maximum size is 10MB.'
      );
    });
    const req = buildRequestWithFile({});
    const res = await POST(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.message).toMatch(/too large/i);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUploadStationDocument).not.toHaveBeenCalled();
    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it('returns 429 when rate limit blocks request', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ blocked: true });
    const req = buildRequestWithFile({});
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('TOO_MANY_REQUESTS');
    expect(mockValidateStationDocumentFile).not.toHaveBeenCalled();
    expect(mockUploadStationDocument).not.toHaveBeenCalled();
  });

  it('returns 400 when multipart body is invalid', async () => {
    const req = new Request('http://localhost/api/v1/stations/onboarding/upload', {
      method: 'POST',
      body: 'not-multipart',
      headers: { 'Content-Type': 'text/plain' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it('does not leak path in response when filename contains path traversal', async () => {
    mockUploadStationDocument.mockResolvedValueOnce({
      file_url: '/uploads/safe-uuid.jpg',
      storage: 'local',
    });
    const req = buildRequestWithFile({
      fileName: '../../../etc/passwd.jpg',
      type: 'image/jpeg',
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.url).not.toContain('..');
    expect(body.data.url).not.toContain('etc');
  });
});
