/**
 * Unit tests for payment-service.ts.
 *
 * All Stripe SDK calls are mocked via @/lib/stripe so no network requests
 * are made. Financial event logging is also mocked.
 *
 * @jest-environment node
 */

// %%%%% Mocks — must be hoisted before any imports %%%%%

const mockPaymentIntentsCreate = jest.fn();
const mockPaymentIntentsCapture = jest.fn();
const mockPaymentIntentsCancel = jest.fn();
const mockPaymentIntentsRetrieve = jest.fn();
const mockPaymentIntentsUpdate = jest.fn();
const mockRefundsCreate = jest.fn();
const mockAccountsCreate = jest.fn();
const mockAccountLinksCreate = jest.fn();
const mockTransfersCreateReversal = jest.fn();
const mockChargesRetrieve = jest.fn();

jest.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: (...args: unknown[]) => mockPaymentIntentsCreate(...args),
      capture: (...args: unknown[]) => mockPaymentIntentsCapture(...args),
      cancel: (...args: unknown[]) => mockPaymentIntentsCancel(...args),
      retrieve: (...args: unknown[]) => mockPaymentIntentsRetrieve(...args),
      update: (...args: unknown[]) => mockPaymentIntentsUpdate(...args),
    },
    refunds: {
      create: (...args: unknown[]) => mockRefundsCreate(...args),
    },
    accounts: {
      create: (...args: unknown[]) => mockAccountsCreate(...args),
    },
    accountLinks: {
      create: (...args: unknown[]) => mockAccountLinksCreate(...args),
    },
    transfers: {
      createReversal: (...args: unknown[]) => mockTransfersCreateReversal(...args),
    },
    charges: {
      retrieve: (...args: unknown[]) => mockChargesRetrieve(...args),
    },
  },
}));

const mockLogFinancialEvent = jest.fn();
jest.mock('@/server/payments/financial-event-logger', () => ({
  logFinancialEvent: (...args: unknown[]) => mockLogFinancialEvent(...args),
}));

// %%%%% Imports %%%%%

import Stripe from 'stripe';
import {
  classifyStripeError,
  createPaymentIntent,
  capturePaymentIntent,
  cancelPaymentIntent,
  refundPaymentIntent,
  updatePaymentIntentMetadata,
  distributePenalty,
  createTipPaymentIntent,
  createStripeConnectAccount,
  createStripeOnboardingLink,
  getStripeReceiptUrl,
} from '@/server/payments/payment-service';
import { ConflictError, ValidationError } from '@/lib/errors';


// %%%%% Helpers for Stripe errors %%%%%

function makeConnectionError(message = 'Connection failed'): Stripe.errors.StripeConnectionError {
  return new Stripe.errors.StripeConnectionError({ message, type: 'StripeConnectionError' } as never);
}

function makeAPIError(message = 'API error'): Stripe.errors.StripeAPIError {
  return new Stripe.errors.StripeAPIError({ message, type: 'StripeAPIError' } as never);
}

function makeCardError(code = 'card_declined', message = 'Card declined'): Stripe.errors.StripeCardError {
  return new Stripe.errors.StripeCardError({ message, code, type: 'StripeCardError', decline_code: 'insufficient_funds' } as never);
}

function makeInvalidRequestError(code = 'resource_missing', message = 'No such resource'): Stripe.errors.StripeInvalidRequestError {
  return new Stripe.errors.StripeInvalidRequestError({ message, code, type: 'StripeInvalidRequestError', param: 'id' } as never);
}


// %%%%% Fixtures %%%%%

const VALID_PI_PARAMS = {
  amountCents: 5000,
  userId: 'user-uuid-0001',
  stationId: 'station-uuid-0001',
  stationStripeAccountId: 'acct_test123',
  commissionCents: 500,
};

const FAKE_PI_ID = 'pi_fake_0001';
const FAKE_CLIENT_SECRET = 'pi_fake_0001_secret_abc';
const FAKE_CHARGE_ID = 'ch_fake_0001';
const FAKE_TRANSFER_ID = 'tr_fake_0001';
const FAKE_REFUND_ID = 're_fake_0001';
const FAKE_REVERSAL_ID = 'trr_fake_0001';
const FAKE_ACCOUNT_ID = 'acct_fake_0001';


// %%%%% Setup %%%%%

beforeEach(() => {
  jest.clearAllMocks();
});


// ---------------------------------------------------------------------------
// classifyStripeError
// ---------------------------------------------------------------------------

describe('classifyStripeError', () => {
  it('classifies StripeConnectionError as network', () => {
    const result = classifyStripeError(makeConnectionError('Connection timed out'));
    expect(result.class).toBe('network');
    expect(result.message).toBe('Connection timed out');
    expect(result.code).toBeNull();
  });

  it('classifies StripeAPIError as network', () => {
    const result = classifyStripeError(makeAPIError('Internal Stripe API error'));
    expect(result.class).toBe('network');
  });

  it('classifies StripeCardError as card_declined with code', () => {
    const result = classifyStripeError(makeCardError('card_declined', 'Your card was declined'));
    expect(result.class).toBe('card_declined');
    expect(result.code).toBe('card_declined');
    expect(result.message).toBe('Your card was declined');
  });

  it('classifies StripeInvalidRequestError as invalid_request with code', () => {
    const result = classifyStripeError(makeInvalidRequestError('resource_missing', 'No such payment_intent'));
    expect(result.class).toBe('invalid_request');
    expect(result.code).toBe('resource_missing');
  });

  it('classifies a generic Error as unknown', () => {
    const result = classifyStripeError(new Error('Something unexpected'));
    expect(result.class).toBe('unknown');
    expect(result.code).toBeNull();
    expect(result.message).toBe('Something unexpected');
  });

  it('classifies a non-Error value as unknown', () => {
    const result = classifyStripeError('raw string error');
    expect(result.class).toBe('unknown');
    expect(result.message).toBe('raw string error');
  });
});


// ---------------------------------------------------------------------------
// createPaymentIntent
// ---------------------------------------------------------------------------

describe('createPaymentIntent', () => {
  beforeEach(() => {
    mockPaymentIntentsCreate.mockResolvedValue({
      id: FAKE_PI_ID,
      client_secret: FAKE_CLIENT_SECRET,
    });
  });

  it('creates a PI and returns paymentIntentId and clientSecret', async () => {
    const result = await createPaymentIntent(VALID_PI_PARAMS);

    expect(result.paymentIntentId).toBe(FAKE_PI_ID);
    expect(result.clientSecret).toBe(FAKE_CLIENT_SECRET);
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: 'cad',
        capture_method: 'manual',
        application_fee_amount: 500,
        transfer_data: { destination: 'acct_test123' },
      }),
      undefined,
    );
    expect(mockLogFinancialEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'PI_CREATED' }));
  });

  it('passes the idempotency key to Stripe when provided', async () => {
    await createPaymentIntent({ ...VALID_PI_PARAMS, idempotencyKey: 'pi-create:entry-001' });

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.anything(),
      { idempotencyKey: 'pi-create:entry-001' },
    );
  });

  it('merges user_id and station_id into metadata', async () => {
    await createPaymentIntent({ ...VALID_PI_PARAMS, metadata: { entry_id: 'entry-001' } });

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          entry_id: 'entry-001',
          user_id: VALID_PI_PARAMS.userId,
          station_id: VALID_PI_PARAMS.stationId,
        }),
      }),
      undefined,
    );
  });

  it('throws ValidationError for zero amount', async () => {
    await expect(createPaymentIntent({ ...VALID_PI_PARAMS, amountCents: 0 })).rejects.toBeInstanceOf(ValidationError);
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
  });

  it('throws ValidationError for negative amount', async () => {
    await expect(createPaymentIntent({ ...VALID_PI_PARAMS, amountCents: -100 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for non-integer amount', async () => {
    await expect(createPaymentIntent({ ...VALID_PI_PARAMS, amountCents: 99.5 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when commissionCents exceeds amountCents', async () => {
    await expect(createPaymentIntent({ ...VALID_PI_PARAMS, commissionCents: 6000 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when commissionCents is negative', async () => {
    await expect(createPaymentIntent({ ...VALID_PI_PARAMS, commissionCents: -1 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when stationStripeAccountId does not start with acct_', async () => {
    await expect(
      createPaymentIntent({ ...VALID_PI_PARAMS, stationStripeAccountId: 'invalid-account' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ConflictError when Stripe reports station capabilities not configured', async () => {
    mockPaymentIntentsCreate.mockRejectedValue(
      makeInvalidRequestError('account_invalid', 'destination account needs to have at least one of the following capabilities'),
    );

    await expect(createPaymentIntent(VALID_PI_PARAMS)).rejects.toBeInstanceOf(ConflictError);
  });

  it('rethrows other Stripe errors as-is', async () => {
    const stripeErr = makeConnectionError('Network timeout');
    mockPaymentIntentsCreate.mockRejectedValue(stripeErr);

    await expect(createPaymentIntent(VALID_PI_PARAMS)).rejects.toBe(stripeErr);
  });

  it('throws when Stripe returns no client_secret', async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: FAKE_PI_ID, client_secret: null });

    await expect(createPaymentIntent(VALID_PI_PARAMS)).rejects.toThrow('client_secret');
  });
});


// ---------------------------------------------------------------------------
// capturePaymentIntent
// ---------------------------------------------------------------------------

describe('capturePaymentIntent', () => {
  const fakeCharge = {
    id: FAKE_CHARGE_ID,
    transfer: FAKE_TRANSFER_ID,
  };

  it('captures a PI and returns chargeId, transferId, and charged=true', async () => {
    mockPaymentIntentsCapture.mockResolvedValue({
      id: FAKE_PI_ID,
      status: 'succeeded',
      latest_charge: fakeCharge,
    });

    const result = await capturePaymentIntent(FAKE_PI_ID);

    expect(result.charged).toBe(true);
    expect(result.chargeId).toBe(FAKE_CHARGE_ID);
    expect(result.transferId).toBe(FAKE_TRANSFER_ID);
    expect(mockLogFinancialEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'PI_CAPTURED' }));
  });

  it('returns charged=false when PI was already canceled', async () => {
    const unexpectedStateError = makeInvalidRequestError('payment_intent_unexpected_state', 'PI already canceled');
    unexpectedStateError.code = 'payment_intent_unexpected_state';
    mockPaymentIntentsCapture.mockRejectedValue(unexpectedStateError);
    mockPaymentIntentsRetrieve.mockResolvedValue({ id: FAKE_PI_ID, status: 'canceled', latest_charge: null });

    const result = await capturePaymentIntent(FAKE_PI_ID);

    expect(result.charged).toBe(false);
    expect(result.chargeId).toBeNull();
    expect(result.transferId).toBeNull();
  });

  it('returns charged=true (idempotent) when PI was already succeeded before capture', async () => {
    const unexpectedStateError = makeInvalidRequestError('payment_intent_unexpected_state', 'PI already succeeded');
    unexpectedStateError.code = 'payment_intent_unexpected_state';
    mockPaymentIntentsCapture.mockRejectedValue(unexpectedStateError);
    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: FAKE_PI_ID,
      status: 'succeeded',
      latest_charge: fakeCharge,
    });

    const result = await capturePaymentIntent(FAKE_PI_ID);

    expect(result.charged).toBe(true);
    expect(result.chargeId).toBe(FAKE_CHARGE_ID);
  });

  it('rethrows unexpected Stripe errors', async () => {
    const networkErr = makeConnectionError();
    mockPaymentIntentsCapture.mockRejectedValue(networkErr);

    await expect(capturePaymentIntent(FAKE_PI_ID)).rejects.toBe(networkErr);
  });
});


// ---------------------------------------------------------------------------
// cancelPaymentIntent
// ---------------------------------------------------------------------------

describe('cancelPaymentIntent', () => {
  it('cancels the PI and logs a PI_CANCELLED event', async () => {
    mockPaymentIntentsCancel.mockResolvedValue({ id: FAKE_PI_ID, status: 'canceled' });

    await cancelPaymentIntent(FAKE_PI_ID);

    expect(mockPaymentIntentsCancel).toHaveBeenCalledWith(FAKE_PI_ID);
    expect(mockLogFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'PI_CANCELLED', stripePaymentIntentId: FAKE_PI_ID }),
    );
  });
});


// ---------------------------------------------------------------------------
// refundPaymentIntent
// ---------------------------------------------------------------------------

describe('refundPaymentIntent', () => {
  beforeEach(() => {
    mockRefundsCreate.mockResolvedValue({ id: FAKE_REFUND_ID });
  });

  it('issues a full refund and returns the refund ID', async () => {
    const refundId = await refundPaymentIntent(FAKE_PI_ID);

    expect(refundId).toBe(FAKE_REFUND_ID);
    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: FAKE_PI_ID }),
      undefined,
    );
    expect(mockLogFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'REFUND_ISSUED', stripePaymentIntentId: FAKE_PI_ID }),
    );
  });

  it('issues a partial refund when amountCents is provided', async () => {
    await refundPaymentIntent(FAKE_PI_ID, 2500);

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2500 }),
      undefined,
    );
  });

  it('reverses the transfer when reverseTransfer=true', async () => {
    await refundPaymentIntent(FAKE_PI_ID, undefined, undefined, true);

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ reverse_transfer: true }),
      undefined,
    );
  });

  it('passes the idempotency key to Stripe', async () => {
    await refundPaymentIntent(FAKE_PI_ID, undefined, 'refund-idem-key');

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.anything(),
      { idempotencyKey: 'refund-idem-key' },
    );
  });
});


// ---------------------------------------------------------------------------
// updatePaymentIntentMetadata
// ---------------------------------------------------------------------------

describe('updatePaymentIntentMetadata', () => {
  it('calls stripe.paymentIntents.update with the new metadata', async () => {
    mockPaymentIntentsUpdate.mockResolvedValue({ id: FAKE_PI_ID });
    const metadata = { reservation_id: 'rsv-001' };

    await updatePaymentIntentMetadata(FAKE_PI_ID, metadata);

    expect(mockPaymentIntentsUpdate).toHaveBeenCalledWith(FAKE_PI_ID, { metadata });
  });
});


// ---------------------------------------------------------------------------
// distributePenalty
// ---------------------------------------------------------------------------

describe('distributePenalty', () => {
  beforeEach(() => {
    mockTransfersCreateReversal.mockResolvedValue({ id: FAKE_REVERSAL_ID });
  });

  it('returns null when penaltyCents is zero', async () => {
    const result = await distributePenalty(FAKE_PI_ID, 0, 0.3);
    expect(result).toBeNull();
    expect(mockTransfersCreateReversal).not.toHaveBeenCalled();
  });

  it('returns null when penaltyCents is negative', async () => {
    const result = await distributePenalty(FAKE_PI_ID, -100, 0.3);
    expect(result).toBeNull();
  });

  it('uses preloaded chargeId and transferId without extra Stripe calls', async () => {
    const result = await distributePenalty(FAKE_PI_ID, 1000, 0.3, undefined, FAKE_CHARGE_ID, FAKE_TRANSFER_ID);

    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
    expect(mockChargesRetrieve).not.toHaveBeenCalled();
    // station keeps 30% = 300, platform claws back 70% = 700
    expect(mockTransfersCreateReversal).toHaveBeenCalledWith(
      FAKE_TRANSFER_ID,
      { amount: 700 },
      undefined,
    );
    expect(result).toBe(FAKE_REVERSAL_ID);
    expect(mockLogFinancialEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'PENALTY_DISTRIBUTED' }));
  });

  it('fetches transfer from Stripe when not preloaded', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue({ id: FAKE_PI_ID, latest_charge: FAKE_CHARGE_ID });
    mockChargesRetrieve.mockResolvedValue({ id: FAKE_CHARGE_ID, transfer: FAKE_TRANSFER_ID });

    const result = await distributePenalty(FAKE_PI_ID, 1000, 0.3);

    expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith(FAKE_PI_ID);
    expect(mockChargesRetrieve).toHaveBeenCalledWith(FAKE_CHARGE_ID);
    expect(result).toBe(FAKE_REVERSAL_ID);
  });

  it('returns null when no transfer exists on the charge', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue({ id: FAKE_PI_ID, latest_charge: FAKE_CHARGE_ID });
    mockChargesRetrieve.mockResolvedValue({ id: FAKE_CHARGE_ID, transfer: null });

    const result = await distributePenalty(FAKE_PI_ID, 1000, 0.3);

    expect(result).toBeNull();
    expect(mockTransfersCreateReversal).not.toHaveBeenCalled();
  });

  it('returns null when the station keeps 100% of the penalty (no clawback)', async () => {
    // stationPenaltyShare = 1.0 → station keeps all → clawback = 0
    const result = await distributePenalty(FAKE_PI_ID, 1000, 1.0, undefined, FAKE_CHARGE_ID, FAKE_TRANSFER_ID);

    expect(result).toBeNull();
    expect(mockTransfersCreateReversal).not.toHaveBeenCalled();
  });

  it('passes the idempotency key to the reversal', async () => {
    await distributePenalty(FAKE_PI_ID, 1000, 0.3, 'penalty-idem-key', FAKE_CHARGE_ID, FAKE_TRANSFER_ID);

    expect(mockTransfersCreateReversal).toHaveBeenCalledWith(
      FAKE_TRANSFER_ID,
      expect.anything(),
      { idempotencyKey: 'penalty-idem-key' },
    );
  });
});


// ---------------------------------------------------------------------------
// createTipPaymentIntent
// ---------------------------------------------------------------------------

describe('createTipPaymentIntent', () => {
  const TIP_PARAMS = {
    amountCents: 1000,
    currency: 'cad',
    userId: 'user-uuid-0001',
    stationId: 'station-uuid-0001',
    stationStripeAccountId: 'acct_test123',
    reservationId: 'rsv-uuid-0001',
  };

  beforeEach(() => {
    mockPaymentIntentsCreate.mockResolvedValue({
      id: 'pi_tip_0001',
      client_secret: 'pi_tip_0001_secret_xyz',
    });
  });

  it('creates a tip PI with automatic capture and returns clientSecret', async () => {
    const result = await createTipPaymentIntent(TIP_PARAMS);

    expect(result.paymentIntentId).toBe('pi_tip_0001');
    expect(result.clientSecret).toBe('pi_tip_0001_secret_xyz');
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        capture_method: 'automatic',
        transfer_data: { destination: 'acct_test123' },
        metadata: expect.objectContaining({ type: 'tip', reservation_id: TIP_PARAMS.reservationId }),
      }),
      undefined,
    );
  });

  it('throws ValidationError for zero or negative amount', async () => {
    await expect(createTipPaymentIntent({ ...TIP_PARAMS, amountCents: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(createTipPaymentIntent({ ...TIP_PARAMS, amountCents: -500 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when account does not start with acct_', async () => {
    await expect(
      createTipPaymentIntent({ ...TIP_PARAMS, stationStripeAccountId: 'bad-account' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('passes the idempotency key to Stripe', async () => {
    await createTipPaymentIntent({ ...TIP_PARAMS, idempotencyKey: 'tip-create:rsv-001' });

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.anything(),
      { idempotencyKey: 'tip-create:rsv-001' },
    );
  });
});


// ---------------------------------------------------------------------------
// createStripeConnectAccount
// ---------------------------------------------------------------------------

describe('createStripeConnectAccount', () => {
  it('creates an Express account and returns the account ID', async () => {
    mockAccountsCreate.mockResolvedValue({ id: FAKE_ACCOUNT_ID });

    const result = await createStripeConnectAccount('station@example.com', 'station-uuid-0001');

    expect(result).toBe(FAKE_ACCOUNT_ID);
    expect(mockAccountsCreate).toHaveBeenCalledWith({
      type: 'express',
      email: 'station@example.com',
      metadata: { station_id: 'station-uuid-0001' },
    });
  });

  it('throws ValidationError for blank email', async () => {
    await expect(createStripeConnectAccount('  ', 'station-uuid-0001')).rejects.toBeInstanceOf(ValidationError);
    expect(mockAccountsCreate).not.toHaveBeenCalled();
  });

  it('throws ValidationError for blank stationId', async () => {
    await expect(createStripeConnectAccount('station@example.com', '')).rejects.toBeInstanceOf(ValidationError);
    expect(mockAccountsCreate).not.toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// createStripeOnboardingLink
// ---------------------------------------------------------------------------

describe('createStripeOnboardingLink', () => {
  const FAKE_ONBOARDING_URL = 'https://connect.stripe.com/setup/e/acct_fake_0001/xyz';

  it('creates an onboarding link and returns the URL', async () => {
    mockAccountLinksCreate.mockResolvedValue({ url: FAKE_ONBOARDING_URL });

    const result = await createStripeOnboardingLink(FAKE_ACCOUNT_ID);

    expect(result).toBe(FAKE_ONBOARDING_URL);
    expect(mockAccountLinksCreate).toHaveBeenCalledWith(expect.objectContaining({
      account: FAKE_ACCOUNT_ID,
      type: 'account_onboarding',
      refresh_url: expect.stringContaining('stripe-refresh'),
      return_url: expect.stringContaining('stripe-return'),
    }));
  });

  it('throws ValidationError when accountId does not start with acct_', async () => {
    await expect(createStripeOnboardingLink('not-an-account-id')).rejects.toBeInstanceOf(ValidationError);
    expect(mockAccountLinksCreate).not.toHaveBeenCalled();
  });

  it('uses the provided locale in the refresh/return URLs', async () => {
    mockAccountLinksCreate.mockResolvedValue({ url: FAKE_ONBOARDING_URL });

    await createStripeOnboardingLink(FAKE_ACCOUNT_ID, 'en');

    expect(mockAccountLinksCreate).toHaveBeenCalledWith(expect.objectContaining({
      refresh_url: expect.stringContaining('/en/'),
      return_url: expect.stringContaining('/en/'),
    }));
  });
});


// ---------------------------------------------------------------------------
// getStripeReceiptUrl
// ---------------------------------------------------------------------------

describe('getStripeReceiptUrl', () => {
  it('returns receipt URL from an expanded charge object', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: FAKE_PI_ID,
      latest_charge: { id: FAKE_CHARGE_ID, receipt_url: 'https://pay.stripe.com/receipts/abc' },
    });

    const result = await getStripeReceiptUrl(FAKE_PI_ID);

    expect(result).toBe('https://pay.stripe.com/receipts/abc');
    expect(mockChargesRetrieve).not.toHaveBeenCalled();
  });

  it('fetches the charge separately when latest_charge is a string ID', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: FAKE_PI_ID,
      latest_charge: FAKE_CHARGE_ID,
    });
    mockChargesRetrieve.mockResolvedValue({ id: FAKE_CHARGE_ID, receipt_url: 'https://pay.stripe.com/receipts/def' });

    const result = await getStripeReceiptUrl(FAKE_PI_ID);

    expect(mockChargesRetrieve).toHaveBeenCalledWith(FAKE_CHARGE_ID);
    expect(result).toBe('https://pay.stripe.com/receipts/def');
  });

  it('returns null when there is no charge on the PI', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue({ id: FAKE_PI_ID, latest_charge: null });

    const result = await getStripeReceiptUrl(FAKE_PI_ID);

    expect(result).toBeNull();
  });

  it('returns null when the charge has no receipt_url yet', async () => {
    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: FAKE_PI_ID,
      latest_charge: { id: FAKE_CHARGE_ID, receipt_url: null },
    });

    const result = await getStripeReceiptUrl(FAKE_PI_ID);

    expect(result).toBeNull();
  });
});
