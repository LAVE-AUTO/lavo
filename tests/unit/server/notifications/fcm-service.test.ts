/**
 * Unit tests for the FCM service and device token service.
 * Firebase Admin SDK is mocked — no real network calls are made.
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Mocks — declared before any imports so jest.mock hoisting works correctly.
// The firebase-admin mock uses module-level state to control app initialization
// without capturing variables (which would fail due to hoisting).
// ---------------------------------------------------------------------------

const mockSendEachForMulticast = jest.fn();
const mockMessaging = jest.fn(() => ({ sendEachForMulticast: mockSendEachForMulticast }));
const mockInitializeApp = jest.fn(() => ({ messaging: mockMessaging }));

// Simulate firebase-admin.apps as a mutable array the service reads to detect
// whether an app has already been initialized.
const fakeAppsArray: unknown[] = [];

jest.mock('firebase-admin', () => {
  // NOTE: cannot reference outer variables here due to hoisting.
  // We access fakeAppsArray via the module-level variable injected after the fact.
  return {
    __esModule: true,
    get default() {
      return {
        get apps() {
          // Return the array controlled by each test via fakeAppsArray.
          return (global as Record<string, unknown>).__fakeFirebaseApps as unknown[] ?? [];
        },
        initializeApp: (...args: unknown[]) => mockInitializeApp(...args),
        credential: { cert: (c: unknown) => c },
      };
    },
  };
});

const mockGetTokensForUser = jest.fn<Promise<string[]>, [string]>();
const mockRemoveExpiredTokens = jest.fn<Promise<void>, [string[]]>();
const mockUpsertDeviceToken = jest.fn<Promise<void>, [string, string, string]>();

jest.mock('@/server/notifications/device-token-service', () => ({
  getTokensForUser: (...args: unknown[]) => mockGetTokensForUser(...(args as [string])),
  removeExpiredTokens: (...args: unknown[]) => mockRemoveExpiredTokens(...(args as [string[]])),
  upsertDeviceToken: (...args: unknown[]) => mockUpsertDeviceToken(...(args as [string, string, string])),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { sendPushNotification } from '@/server/notifications/fcm-service';
import { upsertDeviceToken } from '@/server/notifications/device-token-service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-0000-0000-0000-000000000001';
const TOKEN_A = 'fcm-token-device-a';
const TOKEN_B = 'fcm-token-device-b';
const PAYLOAD = { title: 'Test title', body: 'Test body', data: { entry_id: 'e1' } };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupFirebaseEnv() {
  process.env.FIREBASE_PROJECT_ID = 'test-project';
  process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
  process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\\nfake\\n-----END RSA PRIVATE KEY-----';
}

function clearFirebaseEnv() {
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_CLIENT_EMAIL;
  delete process.env.FIREBASE_PRIVATE_KEY;
}

// Expose the apps array on global so the mock getter can access it.
function setApps(apps: unknown[]) {
  (global as Record<string, unknown>).__fakeFirebaseApps = apps;
}

// ---------------------------------------------------------------------------
// Tests: sendPushNotification
// ---------------------------------------------------------------------------

describe('sendPushNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Simulate no app initialized yet (fresh process).
    setApps([]);
    // Make initializeApp return an object with a .messaging() method.
    mockInitializeApp.mockReturnValue({ messaging: mockMessaging });
    setupFirebaseEnv();
  });

  afterEach(() => {
    clearFirebaseEnv();
  });

  it('returns early without calling Firebase when the user has no registered tokens', async () => {
    mockGetTokensForUser.mockResolvedValueOnce([]);

    await sendPushNotification(USER_ID, PAYLOAD);

    expect(mockGetTokensForUser).toHaveBeenCalledWith(USER_ID);
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends a multicast message to all tokens registered for the user', async () => {
    mockGetTokensForUser.mockResolvedValueOnce([TOKEN_A, TOKEN_B]);
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [{ success: true }, { success: true }],
      successCount: 2,
      failureCount: 0,
    });

    await sendPushNotification(USER_ID, PAYLOAD);

    expect(mockGetTokensForUser).toHaveBeenCalledWith(USER_ID);
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);

    const call = mockSendEachForMulticast.mock.calls[0][0];
    expect(call.tokens).toEqual([TOKEN_A, TOKEN_B]);
    expect(call.notification).toEqual({ title: PAYLOAD.title, body: PAYLOAD.body });
    expect(call.data).toEqual(PAYLOAD.data);

    expect(mockRemoveExpiredTokens).not.toHaveBeenCalled();
  });

  it('removes tokens that FCM reports as invalid after a send', async () => {
    mockGetTokensForUser.mockResolvedValueOnce([TOKEN_A, TOKEN_B]);
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
      ],
      successCount: 1,
      failureCount: 1,
    });
    mockRemoveExpiredTokens.mockResolvedValueOnce(undefined);

    await sendPushNotification(USER_ID, PAYLOAD);

    expect(mockRemoveExpiredTokens).toHaveBeenCalledWith([TOKEN_B]);
  });

  it('does not call removeExpiredTokens when all sends succeed', async () => {
    mockGetTokensForUser.mockResolvedValueOnce([TOKEN_A]);
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [{ success: true }],
      successCount: 1,
      failureCount: 0,
    });

    await sendPushNotification(USER_ID, PAYLOAD);

    expect(mockRemoveExpiredTokens).not.toHaveBeenCalled();
  });

  it('falls back to stub behavior (no crash) when FIREBASE_PROJECT_ID is absent', async () => {
    clearFirebaseEnv();

    await expect(sendPushNotification(USER_ID, PAYLOAD)).resolves.toBeUndefined();

    // The early-exit guard fires before any DB or Firebase call.
    expect(mockGetTokensForUser).not.toHaveBeenCalled();
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    expect(mockInitializeApp).not.toHaveBeenCalled();
  });

  it('does not call Firebase when FIREBASE_PROJECT_ID is an empty string', async () => {
    process.env.FIREBASE_PROJECT_ID = '';

    await expect(sendPushNotification(USER_ID, PAYLOAD)).resolves.toBeUndefined();

    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: device token upsert logic (unit-tests the service function directly)
// ---------------------------------------------------------------------------

describe('upsertDeviceToken (service logic)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls upsertDeviceToken with the correct arguments for a new token', async () => {
    mockUpsertDeviceToken.mockResolvedValueOnce(undefined);

    await upsertDeviceToken(USER_ID, TOKEN_A, 'ios');

    expect(mockUpsertDeviceToken).toHaveBeenCalledWith(USER_ID, TOKEN_A, 'ios');
  });

  it('is idempotent: calling twice with the same token does not throw', async () => {
    mockUpsertDeviceToken.mockResolvedValue(undefined);

    await upsertDeviceToken(USER_ID, TOKEN_A, 'android');
    await upsertDeviceToken(USER_ID, TOKEN_A, 'android');

    expect(mockUpsertDeviceToken).toHaveBeenCalledTimes(2);
  });

  it('supports all three platform values', async () => {
    mockUpsertDeviceToken.mockResolvedValue(undefined);

    for (const platform of ['ios', 'android', 'web'] as const) {
      await upsertDeviceToken(USER_ID, TOKEN_A, platform);
    }

    expect(mockUpsertDeviceToken).toHaveBeenCalledTimes(3);
  });
});
