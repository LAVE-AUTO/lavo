/**
 * Unit tests for approveStation locale propagation.
 */
jest.mock('@/lib/db', () => ({ db: {} }));

const mockFindStationById = jest.fn();
const mockUpdateStationStatus = jest.fn();
const mockFindById = jest.fn();
const mockSendStationApprovalEmail = jest.fn();
const mockSendStationApplicationAdminNotification = jest.fn();
const mockBuildStationQrPublicUrl = jest.fn();

jest.mock('@/server/station/station-repository', () => ({
  findStationById: (...args: unknown[]) => mockFindStationById(...args),
  updateStationStatus: (...args: unknown[]) => mockUpdateStationStatus(...args),
}));

jest.mock('@/server/auth/user-repository', () => ({
  findById: (...args: unknown[]) => mockFindById(...args),
  findByEmail: jest.fn(),
}));

jest.mock('@/lib/email', () => ({
  sendVerificationEmail: jest.fn(),
  sendStationApprovalEmail: (...args: unknown[]) => mockSendStationApprovalEmail(...args),
  sendStationApplicationAdminNotification: (...args: unknown[]) =>
    mockSendStationApplicationAdminNotification(...args),
}));

jest.mock('@/server/qr/qr-token-service', () => ({
  buildStationQrPublicUrl: (...args: unknown[]) => mockBuildStationQrPublicUrl(...args),
}));

import { APP_URL } from '@/helpers/constants';
import { approveStation } from '@/server/station/station-service';

describe('approveStation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindStationById.mockResolvedValue({
      id: 'station-1',
      user_id: 'user-1',
      name: 'Station One',
      status: 'pending_admin_validation',
    });
    mockUpdateStationStatus.mockResolvedValue(undefined);
    mockFindById.mockResolvedValue({ id: 'user-1', email: 'station@example.com' });
    mockBuildStationQrPublicUrl.mockReturnValue('https://example.com/qr/station-1');
    mockSendStationApprovalEmail.mockResolvedValue(undefined);
    mockSendStationApplicationAdminNotification.mockResolvedValue(undefined);
  });

  it('uses passed locale when sending station approval email', async () => {
    await approveStation('admin-1', 'station-1', 'en');
    await Promise.resolve();
    await Promise.resolve();

    expect(mockSendStationApprovalEmail).toHaveBeenCalledWith(
      'station@example.com',
      'Station One',
      'en',
      { qrPublicUrl: 'https://example.com/qr/station-1' }
    );
  });

  it('passes locale to QR public URL generation', async () => {
    await approveStation('admin-1', 'station-1', 'en');

    expect(mockBuildStationQrPublicUrl).toHaveBeenCalledWith({
      origin: APP_URL,
      locale: 'en',
      stationId: 'station-1',
    });
  });
});
