/**
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetMyNotifications = jest.fn();
const mockGetUnreadCount = jest.fn();
const mockReadNotification = jest.fn();
const mockReadAllNotifications = jest.fn();
const mockRemoveNotification = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/notifications/user-notifications-service', () => ({
  getMyNotifications: (...args: unknown[]) => mockGetMyNotifications(...args),
  getUnreadCount: (...args: unknown[]) => mockGetUnreadCount(...args),
  readNotification: (...args: unknown[]) => mockReadNotification(...args),
  readAllNotifications: (...args: unknown[]) => mockReadAllNotifications(...args),
  removeNotification: (...args: unknown[]) => mockRemoveNotification(...args),
}));

import { GET as GET_FEED } from '@/app/api/v1/me/notifications/route';
import { GET as GET_UNREAD } from '@/app/api/v1/me/notifications/unread-count/route';
import { PATCH as PATCH_ONE } from '@/app/api/v1/me/notifications/[id]/read/route';
import { PATCH as PATCH_ALL } from '@/app/api/v1/me/notifications/read-all/route';
import { DELETE as DELETE_ONE } from '@/app/api/v1/me/notifications/[id]/route';

describe('admin access to /me/notifications*', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue({ sub: 'admin-1', role: 'admin' });
  });

  it('allows admin on feed route', async () => {
    mockGetMyNotifications.mockResolvedValue({ items: [], next_cursor: null, unread_count: 0 });
    const res = await GET_FEED(new Request('http://localhost/api/v1/me/notifications?limit=10'));
    expect(res.status).toBe(200);
    expect(mockGetMyNotifications).toHaveBeenCalledWith('admin-1', expect.objectContaining({ limit: 10 }));
  });

  it('allows admin on unread-count route', async () => {
    mockGetUnreadCount.mockResolvedValue(7);
    const res = await GET_UNREAD(new Request('http://localhost/api/v1/me/notifications/unread-count'));
    expect(res.status).toBe(200);
    expect(mockGetUnreadCount).toHaveBeenCalledWith('admin-1');
  });

  it('allows admin on mark-read route', async () => {
    mockReadNotification.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111' });
    const res = await PATCH_ONE(new Request('http://localhost/api/v1/me/notifications/11111111-1111-1111-1111-111111111111/read', { method: 'PATCH' }), {
      params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }),
    });
    expect(res.status).toBe(200);
    expect(mockReadNotification).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'admin-1');
  });

  it('allows admin on read-all route', async () => {
    mockReadAllNotifications.mockResolvedValue(4);
    const res = await PATCH_ALL(new Request('http://localhost/api/v1/me/notifications/read-all', { method: 'PATCH' }));
    expect(res.status).toBe(200);
    expect(mockReadAllNotifications).toHaveBeenCalledWith('admin-1');
  });

  it('allows admin on delete route', async () => {
    mockRemoveNotification.mockResolvedValue(undefined);
    const res = await DELETE_ONE(new Request('http://localhost/api/v1/me/notifications/11111111-1111-1111-1111-111111111111', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }),
    });
    expect(res.status).toBe(200);
    expect(mockRemoveNotification).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'admin-1');
  });
});
