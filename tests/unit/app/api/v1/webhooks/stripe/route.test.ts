/**
 * API tests for POST /api/v1/webhooks/stripe.
 * @jest-environment node
 */
const mockConstructEvent = jest.fn();
const mockRetrieveCharge = jest.fn();
const mockFindEntryByStripePaymentId = jest.fn();
const mockConfirmEntryIfPendingPayment = jest.fn();
const mockUpdateEntry = jest.fn();
const mockSetStripeTransferIdIfMissing = jest.fn();
const mockSetStripePaymentSucceededAtIfMissing = jest.fn();
const mockSetStripePaymentSucceededNotifiedAtIfMissing = jest.fn();
const mockCancelEntryForStripePaymentFailureIfEligible = jest.fn();
const mockNotifyEntry = jest.fn();
const mockSendPushNotification = jest.fn();
const mockGetPlatformSetting = jest.fn();
const mockSendPaymentSuccessEmail = jest.fn();
const mockSendPaymentFailedEmail = jest.fn();

jest.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
    charges: {
      retrieve: (...args: unknown[]) => mockRetrieveCharge(...args),
    },
  },
}));

jest.mock('@/server/reservations/entry-repository', () => ({
  findEntryByStripePaymentId: (...args: unknown[]) => mockFindEntryByStripePaymentId(...args),
  confirmEntryIfPendingPayment: (...args: unknown[]) => mockConfirmEntryIfPendingPayment(...args),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  setStripeTransferIdIfMissing: (...args: unknown[]) => mockSetStripeTransferIdIfMissing(...args),
  setStripePaymentSucceededAtIfMissing: (...args: unknown[]) => mockSetStripePaymentSucceededAtIfMissing(...args),
  setStripePaymentSucceededNotifiedAtIfMissing: (...args: unknown[]) => mockSetStripePaymentSucceededNotifiedAtIfMissing(...args),
  cancelEntryForStripePaymentFailureIfEligible: (...args: unknown[]) =>
    mockCancelEntryForStripePaymentFailureIfEligible(...args),
}));

jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));

jest.mock('@/server/notifications/fcm-service', () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPushNotification(...args),
}));

jest.mock('@/lib/email', () => ({
  sendPaymentSuccessEmail: (...args: unknown[]) => mockSendPaymentSuccessEmail(...args),
  sendPaymentFailedEmail: (...args: unknown[]) => mockSendPaymentFailedEmail(...args),
}));

jest.mock('@/server/admin/platform-settings-service', () => {
  const truthy = (v: string | null) => v?.trim().toLowerCase() === 'true';
  return {
    getPlatformSetting: mockGetPlatformSetting,
    isAdminEscrowPushEnabled: async () => {
      const canonical = await mockGetPlatformSetting('stripe_admin_notifications_enabled');
      if (canonical !== null) return truthy(canonical);
      const legacy = await mockGetPlatformSetting('enable_admin_push_on_escrow_released');
      return truthy(legacy);
    },
  };
});

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      stations: { findFirst: jest.fn() },
      users: { findMany: jest.fn(), findFirst: jest.fn() },
    },
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  stations: { id: 'id' },
  users: { role: 'role' },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(() => ({})),
}));

jest.mock('@/server/station/slot-repository', () => ({
  decrementSlotBookedCount: jest.fn(),
}));


import { db } from '@/lib/db';
import * as slotRepository from '@/server/station/slot-repository';


function makeRequest(): Request {
  return new Request('http://localhost/api/v1/webhooks/stripe', {
    method: 'POST',
    headers: {
      'stripe-signature': 'sig_test',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ok: true }),
  });
}

async function importRoute() {
  // Avoid jest.resetModules() here: it re-instantiates manual mocks and breaks
  // stable references to mockGetPlatformSetting / platform-settings factory.
  const mod = await import('@/app/api/v1/webhooks/stripe/route');
  return mod.POST;
}

const originalEnv = process.env;


describe('POST /api/v1/webhooks/stripe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, STRIPE_WEBHOOK_SECRET: 'whsec_test' };
    mockGetPlatformSetting.mockResolvedValue('false');
    mockSendPaymentSuccessEmail.mockResolvedValue(undefined);
    mockSendPaymentFailedEmail.mockResolvedValue(undefined);
    const usersFindFirst = db.query.users.findFirst as jest.Mock;
    usersFindFirst.mockResolvedValue({ email: 'client@example.com' });
    const stationsFindFirst = db.query.stations.findFirst as jest.Mock;
    stationsFindFirst.mockResolvedValue({ name: 'Station Alpha' });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('transfer.created', () => {
    it('mappe via metadata.reservation_id sans appeler charges.retrieve', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'transfer.created',
        data: {
          object: {
            id: 'tr_123',
            metadata: { reservation_id: 'entry_meta_1' },
          },
        },
      });

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockRetrieveCharge).not.toHaveBeenCalled();
      expect(mockSetStripeTransferIdIfMissing).toHaveBeenCalledWith('entry_meta_1', 'tr_123');
    });

    it('mappe via fallback source_transaction -> charge -> payment_intent -> reservation', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'transfer.created',
        data: {
          object: {
            id: 'tr_123',
            metadata: {},
            source_transaction: 'ch_123',
          },
        },
      });
      mockRetrieveCharge.mockResolvedValue({ payment_intent: 'pi_123' });
      mockFindEntryByStripePaymentId.mockResolvedValue({
        id: 'entry_1',
      });

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockRetrieveCharge).toHaveBeenCalledWith('ch_123');
      expect(mockSetStripeTransferIdIfMissing).toHaveBeenCalledWith('entry_1', 'tr_123');
    });

    it('accepte charge.payment_intent développé (objet avec id)', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'transfer.created',
        data: {
          object: {
            id: 'tr_123',
            metadata: {},
            source_transaction: 'ch_123',
          },
        },
      });
      mockRetrieveCharge.mockResolvedValue({ payment_intent: { id: 'pi_123' } });
      mockFindEntryByStripePaymentId.mockResolvedValue({ id: 'entry_1' });

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockSetStripeTransferIdIfMissing).toHaveBeenCalledWith('entry_1', 'tr_123');
    });

    it('reste idempotent en replay et n’écrit qu’une fois', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'transfer.created',
        data: {
          object: {
            id: 'tr_123',
            metadata: { reservation_id: 'entry_1' },
          },
        },
      });
      mockSetStripeTransferIdIfMissing.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const first = await POST(makeRequest());
      const second = await POST(makeRequest());

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(mockSetStripeTransferIdIfMissing).toHaveBeenCalledTimes(2);
      expect(mockSetStripeTransferIdIfMissing).toHaveBeenNthCalledWith(1, 'entry_1', 'tr_123');
      expect(mockSetStripeTransferIdIfMissing).toHaveBeenNthCalledWith(2, 'entry_1', 'tr_123');
    });

    it('gère l’ordre/race: premier event sans entry puis replay avec entry', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'transfer.created',
        data: {
          object: { id: 'tr_123', source_transaction: 'ch_123', metadata: {} },
        },
      });
      mockRetrieveCharge.mockResolvedValue({ payment_intent: 'pi_123' });
      mockFindEntryByStripePaymentId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'entry_1' });

      const first = await POST(makeRequest());
      const second = await POST(makeRequest());

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(mockSetStripeTransferIdIfMissing).toHaveBeenCalledTimes(1);
      expect(mockSetStripeTransferIdIfMissing).toHaveBeenCalledWith('entry_1', 'tr_123');
    });

    it('ack 200 sans retry inutile quand payload incohérent', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'transfer.created',
        data: {
          object: {
            id: 'tr_123',
            metadata: {},
            source_transaction: 'not_a_charge',
          },
        },
      });

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockRetrieveCharge).not.toHaveBeenCalled();
      expect(mockSetStripeTransferIdIfMissing).not.toHaveBeenCalled();
    });

    it('ack 200 quand la charge n’a pas de payment_intent (statut inattendu)', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'transfer.created',
        data: {
          object: {
            id: 'tr_123',
            metadata: {},
            source_transaction: 'ch_123',
          },
        },
      });
      mockRetrieveCharge.mockResolvedValue({ payment_intent: null });

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockSetStripeTransferIdIfMissing).not.toHaveBeenCalled();
    });
  });

  describe('payment_intent.succeeded', () => {
    it('reste idempotent en replay + non-duplication notifications', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123', created: 1710000000 } },
      });
      mockFindEntryByStripePaymentId.mockResolvedValue({
        id: 'entry_1',
        user_id: 'user_1',
        station_id: 'station_1',
        status: 'completed',
      });
      mockSetStripePaymentSucceededNotifiedAtIfMissing
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const first = await POST(makeRequest());
      const second = await POST(makeRequest());

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(mockSetStripePaymentSucceededAtIfMissing).toHaveBeenCalledTimes(2);
      expect(mockNotifyEntry).toHaveBeenCalledTimes(1);
      expect(mockNotifyEntry).toHaveBeenCalledWith(
        expect.objectContaining({ entryId: 'entry_1', type: 'invitation_to_rate' })
      );
      expect(mockSendPaymentSuccessEmail).toHaveBeenCalledTimes(1);
      expect(mockSendPaymentSuccessEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          entryId: 'entry_1',
          stationName: 'Station Alpha',
        })
      );
    });

    it('gère l’ordre/race: succeeded avant completed puis replay après completed', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123', created: 1710000000 } },
      });
      mockFindEntryByStripePaymentId
        .mockResolvedValueOnce({
          id: 'entry_1',
          user_id: 'user_1',
          station_id: 'station_1',
          status: 'pending_payment',
        })
        .mockResolvedValueOnce({
          id: 'entry_1',
          user_id: 'user_1',
          station_id: 'station_1',
          status: 'completed',
        });
      mockSetStripePaymentSucceededNotifiedAtIfMissing.mockResolvedValueOnce(true);

      const first = await POST(makeRequest());
      const second = await POST(makeRequest());

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(mockNotifyEntry).toHaveBeenCalledTimes(1);
      expect(mockSendPaymentSuccessEmail).toHaveBeenCalledTimes(1);
    });

    it('ack 200 si id payment_intent invalide (pas de 500 / retry artificiel)', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'not_a_pi', created: 1710000000 } },
      });

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockFindEntryByStripePaymentId).not.toHaveBeenCalled();
    });

    it('envoie push admin quand stripe_admin_notifications_enabled vaut true', async () => {
      const POST = await importRoute();
      const usersFindMany = db.query.users.findMany as jest.Mock;
      usersFindMany.mockResolvedValue([{ id: 'admin_user_1' }]);

      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123', created: 1710000000 } },
      });
      mockFindEntryByStripePaymentId.mockResolvedValue({
        id: 'entry_1',
        user_id: 'user_1',
        station_id: 'station_1',
        status: 'completed',
      });
      mockSetStripePaymentSucceededNotifiedAtIfMissing.mockResolvedValue(true);

      mockGetPlatformSetting.mockImplementation(async (key: string) => {
        if (key === 'enable_station_push_on_escrow_released') return 'false';
        if (key === 'stripe_admin_notifications_enabled') return 'true';
        return null;
      });

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        'admin_user_1',
        expect.objectContaining({
          data: expect.objectContaining({ type: 'escrow_released_admin' }),
        })
      );
      expect(mockSendPaymentSuccessEmail).toHaveBeenCalledTimes(1);
    });

    it('utilise enable_admin_push_on_escrow_released si la clé canonique est absente', async () => {
      const POST = await importRoute();
      const usersFindMany = db.query.users.findMany as jest.Mock;
      usersFindMany.mockResolvedValue([{ id: 'admin_user_1' }]);

      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123', created: 1710000000 } },
      });
      mockFindEntryByStripePaymentId.mockResolvedValue({
        id: 'entry_1',
        user_id: 'user_1',
        station_id: 'station_1',
        status: 'completed',
      });
      mockSetStripePaymentSucceededNotifiedAtIfMissing.mockResolvedValue(true);

      mockGetPlatformSetting.mockImplementation(async (key: string) => {
        if (key === 'enable_station_push_on_escrow_released') return 'false';
        if (key === 'stripe_admin_notifications_enabled') return null;
        if (key === 'enable_admin_push_on_escrow_released') return 'true';
        return null;
      });

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        'admin_user_1',
        expect.objectContaining({
          data: expect.objectContaining({ type: 'escrow_released_admin' }),
        })
      );
      expect(mockSendPaymentSuccessEmail).toHaveBeenCalledTimes(1);
    });

    it('ack 200 quand entry absente', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123', created: 1710000000 } },
      });
      mockFindEntryByStripePaymentId.mockResolvedValue(null);

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockSetStripePaymentSucceededAtIfMissing).not.toHaveBeenCalled();
      expect(mockNotifyEntry).not.toHaveBeenCalled();
      expect(mockSendPaymentSuccessEmail).not.toHaveBeenCalled();
    });

    it('ack 200 pour statut inattendu (non completed) sans notifier', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123', created: 1710000000 } },
      });
      mockFindEntryByStripePaymentId.mockResolvedValue({
        id: 'entry_1',
        user_id: 'user_1',
        station_id: 'station_1',
        status: 'confirmed',
      });

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockSetStripePaymentSucceededAtIfMissing).toHaveBeenCalledTimes(1);
      expect(mockSetStripePaymentSucceededNotifiedAtIfMissing).not.toHaveBeenCalled();
      expect(mockNotifyEntry).not.toHaveBeenCalled();
      expect(mockSendPaymentSuccessEmail).not.toHaveBeenCalled();
    });

    it('n’envoie pas l’email succès si l’utilisateur n’a pas d’email', async () => {
      const POST = await importRoute();
      const usersFindFirst = db.query.users.findFirst as jest.Mock;
      usersFindFirst.mockResolvedValue({ email: '' });

      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123', created: 1710000000 } },
      });
      mockFindEntryByStripePaymentId.mockResolvedValue({
        id: 'entry_1',
        user_id: 'user_1',
        station_id: 'station_1',
        status: 'completed',
      });
      mockSetStripePaymentSucceededNotifiedAtIfMissing.mockResolvedValue(true);

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockNotifyEntry).toHaveBeenCalledTimes(1);
      expect(mockSendPaymentSuccessEmail).not.toHaveBeenCalled();
    });
  });

  describe('payment_intent.payment_failed', () => {
    it('décrémente le créneau une seule fois en replay (annulation atomique)', async () => {
      const POST = await importRoute();
      const decrement = jest.mocked(slotRepository.decrementSlotBookedCount);
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_123' } },
      });
      mockFindEntryByStripePaymentId.mockResolvedValue({
        id: 'entry_1',
        user_id: 'user_1',
        station_id: 'station_1',
        status: 'pending_payment',
        time_slot_id: 'slot_1',
      });
      const cancelledRow = {
        id: 'entry_1',
        user_id: 'user_1',
        station_id: 'station_1',
        status: 'cancelled',
        time_slot_id: 'slot_1',
      };
      mockCancelEntryForStripePaymentFailureIfEligible
        .mockResolvedValueOnce(cancelledRow as never)
        .mockResolvedValueOnce(undefined);

      const first = await POST(makeRequest());
      const second = await POST(makeRequest());

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(decrement).toHaveBeenCalledTimes(1);
      expect(decrement).toHaveBeenCalledWith('slot_1', expect.anything());
      expect(mockNotifyEntry).toHaveBeenCalledTimes(1);
      expect(mockSendPaymentFailedEmail).toHaveBeenCalledTimes(1);
      expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          reason: 'Payment failed',
        })
      );
    });

    it('envoie l’email échec sur payment_intent.canceled avec le motif annulation', async () => {
      const POST = await importRoute();
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.canceled',
        data: { object: { id: 'pi_456' } },
      });
      mockFindEntryByStripePaymentId.mockResolvedValue({
        id: 'entry_2',
        user_id: 'user_2',
        station_id: 'station_1',
        status: 'pending_payment',
        time_slot_id: 'slot_2',
      });
      mockCancelEntryForStripePaymentFailureIfEligible.mockResolvedValue({
        id: 'entry_2',
        user_id: 'user_2',
        station_id: 'station_1',
        status: 'cancelled',
        time_slot_id: 'slot_2',
      } as never);

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(mockSendPaymentFailedEmail).toHaveBeenCalledTimes(1);
      expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          reason: 'Payment cancelled',
        })
      );
    });
  });
});
