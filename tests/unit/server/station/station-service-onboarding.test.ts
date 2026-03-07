/**
 * Unit tests for completeStationOnboarding: admin notification and
 * pending_uploads rows created only for documents with storage 'local'.
 */
const pendingUploadsCalls: { station_document_id: string }[] = [];

jest.mock('@/lib/db', () => {
  const schema = jest.requireActual<typeof import('@/lib/db/schema')>('@/lib/db/schema');
  return {
    db: {
      transaction: async (cb: (tx: unknown) => Promise<{ user: unknown; station: unknown }>) => {
        const newUser = {
          id: 'user-1',
          email: '',
          phone: '',
          password_hash: 'hash',
          role: 'station',
          status: 'pending_verification',
          created_at: new Date(),
          updated_at: new Date(),
        };
        const newStation = {
          id: 'station-1',
          user_id: 'user-1',
          name: 'Test Station',
          legal_name: null,
          registration_number: null,
          address: '123 Main',
          city: 'City',
          latitude: null,
          longitude: null,
          wash_type: 'hand_wash',
          description: null,
          wash_post_count: 2,
          status: 'pending_admin_validation',
          is_open: false,
          total_ratings: 0,
          created_at: new Date(),
          updated_at: new Date(),
        };
        const insert = (table: unknown) => ({
          values: (v: unknown) => {
            const ret = () => {
              if (table === schema.users) {
                return Promise.resolve([{ ...newUser, email: (v as { email: string }).email, phone: (v as { phone: string }).phone }]);
              }
              if (table === schema.emailVerificationTokens) return Promise.resolve([]);
              if (table === schema.stations) {
                return Promise.resolve([{ ...newStation, name: (v as { name: string }).name }]);
              }
              if (table === schema.stationDocuments) {
                const arr = v as Array<{ storage?: string }>;
                return Promise.resolve(
                  arr.map((_x, i) => ({
                    id: `doc-${i}`,
                    station_id: newStation.id,
                    document_type: 'license',
                    file_url: 'https://example.com/f',
                    storage: (arr[i] as { storage?: string }).storage ?? 'cloudinary',
                    terms_accepted: true,
                    created_at: new Date(),
                  }))
                );
              }
              if (table === schema.pendingUploads) {
                return Promise.resolve([]);
              }
              return Promise.resolve([]);
            };
            const result = { returning: ret };
            if (v && typeof v === 'object' && 'station_document_id' in v && !('email' in (v as object)) && !('station_id' in (v as object))) {
              pendingUploadsCalls.push(v as { station_document_id: string });
            }
            return result;
          },
        });
        const tx = { insert };
        return cb(tx);
      },
    },
  };
});

jest.mock('@/server/auth/user-repository', () => ({
  findByEmail: jest.fn(),
}));

jest.mock('@/lib/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendStationApplicationAdminNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/server/station/station-repository', () => ({}));
jest.mock('@/server/station/document-repository', () => ({}));

import { findByEmail } from '@/server/auth/user-repository';
import { sendStationApplicationAdminNotification } from '@/lib/email';
import { completeStationOnboarding } from '@/server/station/station-service';

const mockFindByEmail = findByEmail as jest.MockedFunction<typeof findByEmail>;
const mockSendAdminNotification = sendStationApplicationAdminNotification as jest.MockedFunction<typeof sendStationApplicationAdminNotification>;

describe('completeStationOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindByEmail.mockResolvedValue(null);
    pendingUploadsCalls.length = 0;
  });

  it('calls sendStationApplicationAdminNotification with station name and id', async () => {
    const dto = {
      email: 'admin-test@example.com',
      phone: '+15551234567',
      password: 'SecureP@ss1',
      station_name: 'My Wash',
      address: '456 Oak St',
      city: 'Toronto',
      wash_post_count: 1,
      wash_type: 'self_service' as const,
      documents: [
        { document_type: 'license', file_url: 'https://example.com/a.pdf', storage: 'cloudinary' as const },
      ],
      terms_accepted: true as const,
    };
    await completeStationOnboarding(dto);
    expect(mockSendAdminNotification).toHaveBeenCalledTimes(1);
    expect(mockSendAdminNotification).toHaveBeenCalledWith('My Wash', 'station-1');
  });

  it('creates pending_uploads rows only for documents with storage local', async () => {
    const dto = {
      email: 'pending@example.com',
      phone: '+15559999999',
      password: 'SecureP@ss1',
      station_name: 'Pending Wash',
      address: '789 Pine',
      city: 'Vancouver',
      wash_post_count: 2,
      wash_type: 'automatic' as const,
      documents: [
        { document_type: 'license', file_url: 'https://example.com/c.pdf', storage: 'cloudinary' as const },
        { document_type: 'insurance', file_url: 'https://example.com/d.pdf', storage: 'local' as const },
      ],
      terms_accepted: true as const,
    };
    await completeStationOnboarding(dto);
    expect(pendingUploadsCalls).toHaveLength(1);
    expect(pendingUploadsCalls[0].station_document_id).toBe('doc-1');
  });
});
