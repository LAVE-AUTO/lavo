/**
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetClientNotificationPrefs = jest.fn();
const mockPatchClientNotificationPrefs = jest.fn();
const mockGetAdminNotificationPrefs = jest.fn();
const mockPatchAdminNotificationPrefs = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/notifications/user-notification-prefs-repository', () => ({
  getClientNotificationPrefs: (...args: unknown[]) => mockGetClientNotificationPrefs(...args),
  patchClientNotificationPrefs: (...args: unknown[]) => mockPatchClientNotificationPrefs(...args),
  getAdminNotificationPrefs: (...args: unknown[]) => mockGetAdminNotificationPrefs(...args),
  patchAdminNotificationPrefs: (...args: unknown[]) => mockPatchAdminNotificationPrefs(...args),
}));

import { GET, PATCH } from '@/app/api/v1/me/notification-prefs/route';

describe('GET /api/v1/me/notification-prefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns client prefs for client role', async () => {
    mockRequireRole.mockResolvedValue({ sub: 'client-1', role: 'client' });
    mockGetClientNotificationPrefs.mockResolvedValue({ wash_status: true, reminder: true, offers: false, review: true });

    const res = await GET(new Request('http://localhost/api/v1/me/notification-prefs'));
    expect(res.status).toBe(200);
    expect(mockGetClientNotificationPrefs).toHaveBeenCalledWith('client-1');
    expect(mockGetAdminNotificationPrefs).not.toHaveBeenCalled();
  });

  it('returns admin prefs for admin role', async () => {
    mockRequireRole.mockResolvedValue({ sub: 'admin-1', role: 'admin' });
    mockGetAdminNotificationPrefs.mockResolvedValue({
      station_lifecycle: { in_app: true, push: true, email: true },
      kyc_alerts: { in_app: true, push: true, email: true },
      support_alerts: { in_app: true, push: true, email: true },
    });

    const res = await GET(new Request('http://localhost/api/v1/me/notification-prefs'));
    expect(res.status).toBe(200);
    expect(mockGetAdminNotificationPrefs).toHaveBeenCalledWith('admin-1');
    expect(mockGetClientNotificationPrefs).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/me/notification-prefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('patches admin prefs for admin role', async () => {
    mockRequireRole.mockResolvedValue({ sub: 'admin-1', role: 'admin' });
    mockPatchAdminNotificationPrefs.mockResolvedValue({
      station_lifecycle: { in_app: true, push: false, email: true },
      kyc_alerts: { in_app: true, push: true, email: true },
      support_alerts: { in_app: true, push: true, email: false },
    });

    const res = await PATCH(new Request('http://localhost/api/v1/me/notification-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_lifecycle: { push: false }, support_alerts: { email: false } }),
    }));

    expect(res.status).toBe(200);
    expect(mockPatchAdminNotificationPrefs).toHaveBeenCalledWith('admin-1', {
      station_lifecycle: { push: false },
      kyc_alerts: undefined,
      support_alerts: { email: false },
    });
    expect(mockPatchClientNotificationPrefs).not.toHaveBeenCalled();
  });

  it('patches client prefs for client role', async () => {
    mockRequireRole.mockResolvedValue({ sub: 'client-1', role: 'client' });
    mockPatchClientNotificationPrefs.mockResolvedValue({ wash_status: false, reminder: true, offers: true, review: true });

    const res = await PATCH(new Request('http://localhost/api/v1/me/notification-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wash_status: false, offers: true }),
    }));

    expect(res.status).toBe(200);
    expect(mockPatchClientNotificationPrefs).toHaveBeenCalledWith('client-1', {
      wash_status: false,
      reminder: undefined,
      offers: true,
      review: undefined,
    });
    expect(mockPatchAdminNotificationPrefs).not.toHaveBeenCalled();
  });
});
