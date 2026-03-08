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
