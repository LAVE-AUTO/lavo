/**
 * API tests for POST /api/v1/stations/apply.
 * Mocks submitStationApplication and rate-limiter.
 * @jest-environment node
 */
if (typeof globalThis.File === 'undefined') {
  (globalThis as unknown as { File: typeof File }).File = class File extends Blob {
    name: string;
    lastModified: number;
    constructor(
      bits: BlobPart[],
      name: string,
      options?: { type?: string; lastModified?: number }
    ) {
      super(bits, options);
      this.name = name;
      this.lastModified = options?.lastModified ?? Date.now();
    }
  } as unknown as typeof File;
}

const mockSubmitStationApplication = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockRecordFailedAttempt = jest.fn();
const mockResetOnSuccess = jest.fn();

jest.mock('@/server/station/station-service', () => ({
  submitStationApplication: (...args: unknown[]) =>
    mockSubmitStationApplication(...args),
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordFailedAttempt: (...args: unknown[]) => mockRecordFailedAttempt(...args),
  resetOnSuccess: (...args: unknown[]) => mockResetOnSuccess(...args),
}));

const mockHeadersGet = jest.fn((key: string) =>
  key === 'x-forwarded-for' ? '192.168.1.1' : null
);
jest.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: mockHeadersGet }),
}));

import { POST } from '@/app/api/v1/stations/apply/route';

function buildFormData(fields: Record<string, string>, files?: { name: string; file: File }[]) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, v);
  }
  if (files) {
    for (const { name, file } of files) {
      form.append(name, file);
    }
  }
  return form;
}

const validFields = {
  name: 'Station Alpha',
  address: '10 Rue de la Paix',
  city: 'Paris',
  wash_type: 'hand_wash',
  wash_post_count: '4',
  terms_accepted: 'true',
};

function createMockFile(name: string, type: string, size: number): File {
  return new (globalThis.File as typeof File)([new Uint8Array(size)], name, {
    type,
  });
}

describe('POST /api/v1/stations/apply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ blocked: false });
  });

  it('returns 201 when valid formData with fields and at least one document file', async () => {
    mockSubmitStationApplication.mockResolvedValueOnce({
      station_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      message: 'Application submitted',
    });
    const form = buildFormData(validFields, [
      {
        name: 'document_license',
        file: createMockFile('license.pdf', 'application/pdf', 100),
      },
    ]);
    // Node Request may not preserve File when parsing FormData; provide formData() so route sees our form.
    const req = {
      formData: () => Promise.resolve(form),
    } as unknown as Request;
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.station_id).toBeDefined();
    expect(body.data.message).toBeDefined();
    expect(mockSubmitStationApplication).toHaveBeenCalledTimes(1);
    expect(mockResetOnSuccess).toHaveBeenCalledWith('192.168.1.1');
  });

  it('returns 400 when validation fails (e.g. missing name)', async () => {
    const { name: _, ...rest } = validFields;
    const form = buildFormData(rest as Record<string, string>, [
      {
        name: 'document_license',
        file: createMockFile('license.pdf', 'application/pdf', 100),
      },
    ]);
    const req = new Request('http://localhost/api/v1/stations/apply', {
      method: 'POST',
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockSubmitStationApplication).not.toHaveBeenCalled();
    expect(mockRecordFailedAttempt).toHaveBeenCalledWith('192.168.1.1');
  });

  it('returns 400 when no documents', async () => {
    const form = buildFormData(validFields);
    const req = new Request('http://localhost/api/v1/stations/apply', {
      method: 'POST',
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/at least one document/i);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockSubmitStationApplication).not.toHaveBeenCalled();
    expect(mockRecordFailedAttempt).toHaveBeenCalledWith('192.168.1.1');
  });

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ blocked: true });
    const form = buildFormData(validFields, [
      {
        name: 'document_license',
        file: createMockFile('license.pdf', 'application/pdf', 100),
      },
    ]);
    const req = new Request('http://localhost/api/v1/stations/apply', {
      method: 'POST',
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(mockSubmitStationApplication).not.toHaveBeenCalled();
  });
});
