/**
 * Unit tests for client-feed-notifications: notifyClientFeed.
 * All DB dependencies are mocked - no real DB calls are made.
 * @jest-environment node
 */

// %%%%% Mocks %%%%%

const mockGetClientNotificationPrefs = jest.fn();
const mockInsertUserNotification = jest.fn();

jest.mock('@/server/notifications/user-notification-prefs-repository', () => ({
  getClientNotificationPrefs: (...args: unknown[]) => mockGetClientNotificationPrefs(...args),
}));

jest.mock('@/server/notifications/user-notifications-repository', () => ({
  insertUserNotification: (...args: unknown[]) => mockInsertUserNotification(...args),
}));


// %%%%% Imports %%%%%

import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';


// %%%%% Fixtures %%%%%

const USER_ID = 'user-0000-0000-0000-000000000001';
const ENTRY_ID = 'entry-000-0000-0000-000000000001';
const STATION_ID = 'station-000-0000-0000-00000000001';

const ALL_PREFS_ON = {
  wash_status: true,
  reminder: true,
  offers: true,
  review: true,
};

const ALL_PREFS_OFF = {
  wash_status: false,
  reminder: false,
  offers: false,
  review: false,
};


// %%%%% Setup %%%%%

beforeEach(() => {
  jest.clearAllMocks();
  mockInsertUserNotification.mockResolvedValue({ id: 'notif-1' });
});


// %%%%% Tests %%%%%

describe('notifyClientFeed', () => {

  // ── Pref gating ──────────────────────────────────────────────────────────

  it('inserts notification when wash_status pref is on', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      stationId: STATION_ID,
      kind: 'reservation_confirmed',
      body: 'Votre réservation est confirmée.',
    });

    expect(mockInsertUserNotification).toHaveBeenCalledTimes(1);
    expect(mockInsertUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        kind: 'reservation_confirmed',
        title: 'Paiement reçu',
        body: 'Votre réservation est confirmée.',
        action_url: `/client/reservations/${ENTRY_ID}`,
        payload: { entry_id: ENTRY_ID, station_id: STATION_ID },
      })
    );
  });

  it('skips insertion when wash_status pref is false', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_OFF);

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      kind: 'service_completed',
      body: 'Votre lavage est terminé !',
    });

    expect(mockInsertUserNotification).not.toHaveBeenCalled();
  });

  it('inserts notification when reminder pref is on', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      stationId: STATION_ID,
      kind: 'reservation_reminder_24h',
      body: 'Vous avez une réservation prévue demain.',
    });

    expect(mockInsertUserNotification).toHaveBeenCalledTimes(1);
    expect(mockInsertUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'reservation_reminder_24h',
        title: 'Rappel : réservation demain',
      })
    );
  });

  it('skips reminder notification when reminder pref is false', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue({ ...ALL_PREFS_ON, reminder: false });

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      kind: 'reservation_reminder_1h',
      body: 'Votre réservation est dans 1 heure.',
    });

    expect(mockInsertUserNotification).not.toHaveBeenCalled();
  });

  it('inserts invitation_to_rate when review pref is on', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      stationId: STATION_ID,
      kind: 'invitation_to_rate',
      body: 'Évaluez votre visite.',
    });

    expect(mockInsertUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'invitation_to_rate', title: 'Donnez votre avis' })
    );
  });

  it('skips invitation_to_rate when review pref is false', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue({ ...ALL_PREFS_ON, review: false });

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      kind: 'invitation_to_rate',
      body: 'Évaluez votre visite.',
    });

    expect(mockInsertUserNotification).not.toHaveBeenCalled();
  });

  // ── Action URLs ───────────────────────────────────────────────────────────

  it('uses /client/support action URL for support_ticket_created', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      kind: 'support_ticket_created',
      body: 'Votre demande a été enregistrée.',
    });

    expect(mockInsertUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({ action_url: '/client/support' })
    );
  });

  it('uses /client/support action URL for support_message_received', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      kind: 'support_message_received',
      body: 'Vous avez reçu une réponse.',
    });

    expect(mockInsertUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({ action_url: '/client/support' })
    );
  });

  it('uses /client/reservations/:entryId action URL for reservation kinds', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      stationId: STATION_ID,
      kind: 'service_started',
      body: 'Votre lavage a commencé.',
    });

    expect(mockInsertUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({ action_url: `/client/reservations/${ENTRY_ID}` })
    );
  });

  // ── stationId optionality ─────────────────────────────────────────────────

  it('omits station_id from payload when stationId is not provided', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      kind: 'support_ticket_created',
      body: 'Votre demande a été enregistrée.',
    });

    expect(mockInsertUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { entry_id: ENTRY_ID },
      })
    );
  });

  it('includes station_id in payload when stationId is provided', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);

    await notifyClientFeed({
      userId: USER_ID,
      entryId: ENTRY_ID,
      stationId: STATION_ID,
      kind: 'queue_pick',
      body: "C'est votre tour !",
    });

    expect(mockInsertUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { entry_id: ENTRY_ID, station_id: STATION_ID },
      })
    );
  });

  // ── Error resilience ──────────────────────────────────────────────────────

  it('resolves without throwing when getClientNotificationPrefs rejects', async () => {
    mockGetClientNotificationPrefs.mockRejectedValue(new Error('DB connection lost'));

    await expect(
      notifyClientFeed({
        userId: USER_ID,
        entryId: ENTRY_ID,
        kind: 'reservation_confirmed',
        body: 'Votre réservation est confirmée.',
      })
    ).resolves.toBeUndefined();

    expect(mockInsertUserNotification).not.toHaveBeenCalled();
  });

  it('resolves without throwing when insertUserNotification rejects', async () => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);
    mockInsertUserNotification.mockRejectedValue(new Error('Insert failed'));

    await expect(
      notifyClientFeed({
        userId: USER_ID,
        entryId: ENTRY_ID,
        stationId: STATION_ID,
        kind: 'service_completed',
        body: 'Votre lavage est terminé !',
      })
    ).resolves.toBeUndefined();
  });

  // ── All reminder kinds ────────────────────────────────────────────────────

  it.each([
    ['reservation_reminder_24h', 'Rappel : réservation demain'],
    ['reservation_reminder_2h', 'Rappel : réservation dans 2 heures'],
    ['reservation_reminder_1h', 'Rappel : réservation dans 1 heure'],
    ['reservation_reminder_5h', 'Rappel : réservation dans 5 heures'],
    ['reservation_reminder_30min', 'Rappel : réservation dans 30 minutes'],
  ] as const)('inserts %s with correct title', async (kind, expectedTitle) => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);

    await notifyClientFeed({ userId: USER_ID, entryId: ENTRY_ID, kind, body: 'Rappel.' });

    expect(mockInsertUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind, title: expectedTitle })
    );
  });

  // ── wash_status kinds ─────────────────────────────────────────────────────

  it.each([
    'reservation_created',
    'reservation_confirmed',
    'payment_failed',
    'queue_joined',
    'moved_to_queue',
    'entry_cancelled',
    'reservation_cancelled',
    'queue_cancelled_by_client',
    'queue_no_show',
    'service_started',
    'service_completed',
    'client_late',
    'queue_pick',
    'queue_position_changed',
    'reservation_rescheduled',
    'extra_time_delay',
    'slot_beyond_closing',
    'delay_accepted',
    'delay_refused',
    'tip_sent',
  ] as const)('inserts %s when wash_status is on', async (kind) => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_ON);

    await notifyClientFeed({ userId: USER_ID, entryId: ENTRY_ID, kind, body: 'Test body.' });

    expect(mockInsertUserNotification).toHaveBeenCalledTimes(1);
  });

  it.each([
    'reservation_created',
    'service_started',
    'queue_pick',
    'delay_accepted',
  ] as const)('skips %s when wash_status is off', async (kind) => {
    mockGetClientNotificationPrefs.mockResolvedValue(ALL_PREFS_OFF);

    await notifyClientFeed({ userId: USER_ID, entryId: ENTRY_ID, kind, body: 'Test body.' });

    expect(mockInsertUserNotification).not.toHaveBeenCalled();
  });
});
