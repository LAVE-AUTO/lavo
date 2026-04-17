/**
 * Unit tests for entry/reservation/queue validators.
 */
import {
  entryIdParamSchema,
  createReservationBodySchema,
  joinQueueBodySchema,
  upgradeToReservationBodySchema,
  stationPatchEntryBodySchema,
  stationPatchPositionBodySchema,
} from '@/validators/entry';

const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('entry validators', () => {
  describe('entryIdParamSchema', () => {
    it('accepts valid entryId', () => {
      const r = entryIdParamSchema.safeParse({ entryId: validUuid });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.entryId).toBe(validUuid);
    });
    it('rejects non-UUID', () => {
      expect(entryIdParamSchema.safeParse({ entryId: 'x' }).success).toBe(false);
      expect(entryIdParamSchema.safeParse({ entryId: '' }).success).toBe(false);
    });
  });

  describe('createReservationBodySchema', () => {
    it('accepts time_slot_id and vehicle_format_id', () => {
      const r = createReservationBodySchema.safeParse({
        time_slot_id: validUuid,
        vehicle_format_id: validUuid,
      });
      expect(r.success).toBe(true);
    });
    it('rejects extra keys (strict)', () => {
      expect(
        createReservationBodySchema.safeParse({
          time_slot_id: validUuid,
          vehicle_format_id: validUuid,
          extra: true,
        }).success
      ).toBe(false);
    });
    it('rejects missing time_slot_id', () => {
      expect(
        createReservationBodySchema.safeParse({ vehicle_format_id: validUuid }).success
      ).toBe(false);
    });

    it('accepts valid qr_token + v pair', () => {
      const r = createReservationBodySchema.safeParse({
        time_slot_id: validUuid,
        vehicle_format_id: validUuid,
        qr_token: 'a'.repeat(64),
        v: '1',
      });
      expect(r.success).toBe(true);
    });

    it('rejects partial QR payload (token without version)', () => {
      const r = createReservationBodySchema.safeParse({
        time_slot_id: validUuid,
        vehicle_format_id: validUuid,
        qr_token: 'a'.repeat(64),
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(JSON.stringify(r.error.format())).toContain('qr_token and v must be provided together');
      }
    });

    it('rejects partial QR payload (version without token)', () => {
      const r = createReservationBodySchema.safeParse({
        time_slot_id: validUuid,
        vehicle_format_id: validUuid,
        v: '1',
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(JSON.stringify(r.error.format())).toContain('qr_token and v must be provided together');
      }
    });

    it('rejects invalid QR version', () => {
      const r = createReservationBodySchema.safeParse({
        time_slot_id: validUuid,
        vehicle_format_id: validUuid,
        qr_token: 'a'.repeat(64),
        v: '2',
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(JSON.stringify(r.error.format())).toContain('v must be \\\"1\\\"');
      }
    });

    it('rejects invalid qr_token format', () => {
      const r = createReservationBodySchema.safeParse({
        time_slot_id: validUuid,
        vehicle_format_id: validUuid,
        qr_token: 'not-a-signature',
        v: '1',
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(JSON.stringify(r.error.format())).toContain(
          'qr_token must be a 64-character hexadecimal signature'
        );
      }
    });
  });

  describe('joinQueueBodySchema', () => {
    it('accepts vehicle_format_id', () => {
      const r = joinQueueBodySchema.safeParse({ vehicle_format_id: validUuid });
      expect(r.success).toBe(true);
    });
    it('rejects extra keys (strict)', () => {
      expect(
        joinQueueBodySchema.safeParse({
          vehicle_format_id: validUuid,
          extra: true,
        }).success
      ).toBe(false);
    });
    it('rejects missing vehicle_format_id', () => {
      expect(joinQueueBodySchema.safeParse({}).success).toBe(false);
    });
  });

  describe('upgradeToReservationBodySchema', () => {
    it('accepts time_slot_id', () => {
      const r = upgradeToReservationBodySchema.safeParse({ time_slot_id: validUuid });
      expect(r.success).toBe(true);
    });
    it('rejects extra keys (strict)', () => {
      expect(
        upgradeToReservationBodySchema.safeParse({
          time_slot_id: validUuid,
          extra: true,
        }).success
      ).toBe(false);
    });
    it('rejects missing time_slot_id', () => {
      expect(upgradeToReservationBodySchema.safeParse({}).success).toBe(false);
    });
  });

  describe('stationPatchEntryBodySchema', () => {
    it('accepts status in_progress, completed, cancelled', () => {
      expect(stationPatchEntryBodySchema.safeParse({ status: 'in_progress' }).success).toBe(true);
      expect(stationPatchEntryBodySchema.safeParse({ status: 'completed' }).success).toBe(true);
      expect(stationPatchEntryBodySchema.safeParse({ status: 'cancelled' }).success).toBe(true);
    });
    it('rejects invalid status', () => {
      expect(stationPatchEntryBodySchema.safeParse({ status: 'pending' }).success).toBe(false);
      expect(stationPatchEntryBodySchema.safeParse({ status: 'other' }).success).toBe(false);
    });
  });

  describe('stationPatchPositionBodySchema', () => {
    it('accepts queue_position >= 1', () => {
      expect(stationPatchPositionBodySchema.safeParse({ queue_position: 1 }).success).toBe(true);
      expect(stationPatchPositionBodySchema.safeParse({ queue_position: 10 }).success).toBe(true);
    });
    it('rejects queue_position < 1', () => {
      expect(stationPatchPositionBodySchema.safeParse({ queue_position: 0 }).success).toBe(false);
      expect(stationPatchPositionBodySchema.safeParse({ queue_position: -1 }).success).toBe(false);
    });
    it('rejects non-integer', () => {
      expect(stationPatchPositionBodySchema.safeParse({ queue_position: 1.5 }).success).toBe(false);
    });
    it('rejects extra keys (strict)', () => {
      expect(
        stationPatchPositionBodySchema.safeParse({
          queue_position: 1,
          extra: true,
        }).success
      ).toBe(false);
    });
  });
});
