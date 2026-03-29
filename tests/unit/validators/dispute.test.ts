/**
 * Unit tests for dispute validators: create, refund, close, list.
 */
import {
  createDisputeSchema,
  refundDisputeSchema,
  closeDisputeSchema,
  listDisputesQuerySchema,
  disputeIdParamSchema,
} from '@/validators/dispute';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ─── createDisputeSchema ─────────────────────────────────────────────────────

describe('createDisputeSchema', () => {
  const base = { reservation_id: VALID_UUID, reason: 'Rayure sur le capot' };

  it('accepts minimal valid input', () => {
    const r = createDisputeSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('accepts all optional fields', () => {
    const r = createDisputeSchema.safeParse({
      ...base,
      description: 'Detail de la rayure',
      requested_amount: 150.5,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.requested_amount).toBe(150.5);
      expect(r.data.description).toBe('Detail de la rayure');
    }
  });

  it('rounds requested_amount to 2 decimal places', () => {
    const r = createDisputeSchema.safeParse({ ...base, requested_amount: 10.555 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.requested_amount).toBe(10.56);
  });

  it('rejects missing reservation_id', () => {
    expect(createDisputeSchema.safeParse({ reason: 'x' }).success).toBe(false);
  });

  it('rejects invalid reservation_id (not a UUID)', () => {
    expect(createDisputeSchema.safeParse({ ...base, reservation_id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects empty reason', () => {
    expect(createDisputeSchema.safeParse({ ...base, reason: '' }).success).toBe(false);
  });

  it('rejects reason exceeding 500 chars', () => {
    expect(createDisputeSchema.safeParse({ ...base, reason: 'x'.repeat(501) }).success).toBe(false);
  });

  it('rejects description exceeding 2000 chars', () => {
    expect(createDisputeSchema.safeParse({ ...base, description: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('rejects negative requested_amount', () => {
    expect(createDisputeSchema.safeParse({ ...base, requested_amount: -1 }).success).toBe(false);
  });

  it('rejects zero requested_amount', () => {
    expect(createDisputeSchema.safeParse({ ...base, requested_amount: 0 }).success).toBe(false);
  });
});

// ─── refundDisputeSchema ─────────────────────────────────────────────────────

describe('refundDisputeSchema', () => {
  it('accepts empty body (full refund intent)', () => {
    const r = refundDisputeSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBeUndefined();
  });

  it('accepts valid partial amount', () => {
    const r = refundDisputeSchema.safeParse({ amount: 25.0 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(25);
  });

  it('rounds amount to 2 decimal places', () => {
    const r = refundDisputeSchema.safeParse({ amount: 9.999 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(10);
  });

  it('rejects zero amount', () => {
    expect(refundDisputeSchema.safeParse({ amount: 0 }).success).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(refundDisputeSchema.safeParse({ amount: -5 }).success).toBe(false);
  });

  it('rejects non-numeric amount', () => {
    expect(refundDisputeSchema.safeParse({ amount: 'ten' }).success).toBe(false);
  });
});

// ─── closeDisputeSchema ──────────────────────────────────────────────────────

describe('closeDisputeSchema', () => {
  it('accepts resolved with reason', () => {
    const r = closeDisputeSchema.safeParse({ status: 'resolved', reason: 'Client indemnisé' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe('resolved');
      expect(r.data.reason).toBe('Client indemnisé');
    }
  });

  it('accepts rejected with reason', () => {
    const r = closeDisputeSchema.safeParse({ status: 'rejected', reason: 'Litige non fondé' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe('rejected');
  });

  it('rejects missing status', () => {
    expect(closeDisputeSchema.safeParse({ reason: 'Raison' }).success).toBe(false);
  });

  it('rejects invalid status value', () => {
    expect(closeDisputeSchema.safeParse({ status: 'open', reason: 'x' }).success).toBe(false);
    expect(closeDisputeSchema.safeParse({ status: 'refunded', reason: 'x' }).success).toBe(false);
  });

  it('rejects empty reason', () => {
    expect(closeDisputeSchema.safeParse({ status: 'resolved', reason: '' }).success).toBe(false);
  });

  it('rejects reason exceeding 500 chars', () => {
    expect(closeDisputeSchema.safeParse({ status: 'resolved', reason: 'x'.repeat(501) }).success).toBe(false);
  });

  it('rejects missing reason', () => {
    expect(closeDisputeSchema.safeParse({ status: 'resolved' }).success).toBe(false);
  });
});

// ─── listDisputesQuerySchema ─────────────────────────────────────────────────

describe('listDisputesQuerySchema', () => {
  it('defaults page=1 and per_page=20 when absent', () => {
    const r = listDisputesQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.per_page).toBe(20);
    }
  });

  it('parses page and per_page from strings', () => {
    const r = listDisputesQuerySchema.safeParse({ page: '3', per_page: '50' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(3);
      expect(r.data.per_page).toBe(50);
    }
  });

  it('accepts all valid status values', () => {
    for (const status of ['open', 'refunded', 'resolved', 'rejected'] as const) {
      expect(listDisputesQuerySchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(listDisputesQuerySchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('accepts valid station_id and client_id UUIDs', () => {
    const r = listDisputesQuerySchema.safeParse({
      station_id: VALID_UUID,
      client_id: VALID_UUID,
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid station_id (not a UUID)', () => {
    expect(listDisputesQuerySchema.safeParse({ station_id: 'not-a-uuid' }).success).toBe(false);
  });

  it('accepts valid ISO 8601 date_from and date_to', () => {
    const r = listDisputesQuerySchema.safeParse({
      date_from: '2024-01-01T00:00:00Z',
      date_to: '2024-12-31T23:59:59Z',
    });
    expect(r.success).toBe(true);
  });

  it('rejects malformed date_from', () => {
    expect(listDisputesQuerySchema.safeParse({ date_from: '2024-13-01' }).success).toBe(false);
  });

  it('rejects per_page > 100', () => {
    expect(listDisputesQuerySchema.safeParse({ per_page: '101' }).success).toBe(false);
  });

  it('rejects page < 1', () => {
    expect(listDisputesQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});

// ─── disputeIdParamSchema ─────────────────────────────────────────────────────

describe('disputeIdParamSchema', () => {
  it('accepts valid UUID', () => {
    expect(disputeIdParamSchema.safeParse(VALID_UUID).success).toBe(true);
  });

  it('rejects non-UUID string', () => {
    expect(disputeIdParamSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(disputeIdParamSchema.safeParse('').success).toBe(false);
  });
});
