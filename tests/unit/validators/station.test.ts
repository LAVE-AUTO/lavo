/**
 * Unit tests for public stations API validators: list query and path id.
 * Mock shared validators so station.ts loads without libphonenumber-js.
 */
jest.mock('@/validators/shared', () => ({
  phoneSchema: require('zod').z.string().min(1),
}));

import {
  listStationsQuerySchema,
  stationIdParamSchema,
  stationConfigBodySchema,
  createSlotBodySchema,
  createSlotsBulkBodySchema,
  generateSlotsBodySchema,
  deleteSlotsBodySchema,
  slotIdParamSchema,
} from '@/validators/station';

describe('station validators', () => {
  // ---------------------------------------------------------------------------
  // stationIdParamSchema (GET /stations/:id, POST /stations/:id/join)
  // ---------------------------------------------------------------------------
  describe('stationIdParamSchema', () => {
    it('accepts valid UUID', () => {
      const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const r = stationIdParamSchema.safeParse({ id });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.id).toBe(id);
    });

    it('rejects non-UUID string', () => {
      expect(stationIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
      expect(stationIdParamSchema.safeParse({ id: '123' }).success).toBe(false);
      expect(stationIdParamSchema.safeParse({ id: '' }).success).toBe(false);
    });

    it('rejects invalid UUID format', () => {
      expect(stationIdParamSchema.safeParse({ id: 'a1b2c3d4-e5f6-7890-abcd' }).success).toBe(false);
      expect(stationIdParamSchema.safeParse({ id: 'gggggggg-gggg-gggg-gggg-gggggggggggg' }).success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // listStationsQuerySchema (GET /api/v1/stations)
  // ---------------------------------------------------------------------------
  describe('listStationsQuerySchema', () => {
    it('accepts empty or missing params', () => {
      const r1 = listStationsQuerySchema.safeParse({});
      expect(r1.success).toBe(true);
      if (r1.success) {
        expect(r1.data.q).toBeUndefined();
        expect(r1.data.city).toBeUndefined();
        expect(r1.data.sort).toBeUndefined();
      }
      const r2 = listStationsQuerySchema.safeParse({
        q: undefined,
        city: undefined,
        sort: undefined,
      });
      expect(r2.success).toBe(true);
    });

    it('accepts valid sort values', () => {
      expect(listStationsQuerySchema.safeParse({ sort: 'name' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ sort: 'slots_asc' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ sort: 'slots_desc' }).success).toBe(true);
    });

    it('rejects invalid sort value', () => {
      const r = listStationsQuerySchema.safeParse({ sort: 'invalid_sort' });
      expect(r.success).toBe(false);
    });

    it('trims and accepts q and city within limits', () => {
      const r = listStationsQuerySchema.safeParse({
        q: '  Paris  ',
        city: ' Lyon ',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.q).toBe('Paris');
        expect(r.data.city).toBe('Lyon');
      }
    });

    it('rejects q over 200 characters', () => {
      const r = listStationsQuerySchema.safeParse({
        q: 'a'.repeat(201),
      });
      expect(r.success).toBe(false);
    });

    it('rejects city over 100 characters', () => {
      const r = listStationsQuerySchema.safeParse({
        city: 'a'.repeat(101),
      });
      expect(r.success).toBe(false);
    });

    it('accepts q and city at exactly max length', () => {
      expect(listStationsQuerySchema.safeParse({ q: 'a'.repeat(200) }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ city: 'a'.repeat(100) }).success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // stationConfigBodySchema (PATCH /api/v1/station/config)
  // ---------------------------------------------------------------------------
  describe('stationConfigBodySchema', () => {
    it('accepts empty object (all optional)', () => {
      expect(stationConfigBodySchema.safeParse({}).success).toBe(true);
    });

    it('accepts valid time strings', () => {
      expect(stationConfigBodySchema.safeParse({ opening_time: '08:00' }).success).toBe(true);
      expect(stationConfigBodySchema.safeParse({ opening_time: '08:00:00' }).success).toBe(true);
      expect(stationConfigBodySchema.safeParse({ closing_time: '20:00:00+00' }).success).toBe(true);
    });

    it('rejects invalid time format', () => {
      expect(stationConfigBodySchema.safeParse({ opening_time: '25:00' }).success).toBe(false);
      expect(stationConfigBodySchema.safeParse({ opening_time: '08:60' }).success).toBe(false);
    });

    it('accepts valid posts array', () => {
      const r = stationConfigBodySchema.safeParse({
        posts: [{ position: 1, is_active: true }, { position: 2, is_active: false }],
      });
      expect(r.success).toBe(true);
    });

    it('rejects position < 1', () => {
      expect(stationConfigBodySchema.safeParse({ posts: [{ position: 0, is_active: true }] }).success).toBe(false);
    });

    it('rejects duplicate positions in posts', () => {
      const r = stationConfigBodySchema.safeParse({
        posts: [
          { position: 1, is_active: true },
          { position: 2, is_active: true },
          { position: 1, is_active: false },
        ],
      });
      expect(r.success).toBe(false);
    });

    it('rejects invalid time format (hostile)', () => {
      expect(stationConfigBodySchema.safeParse({ opening_time: '24:00' }).success).toBe(false);
      expect(stationConfigBodySchema.safeParse({ closing_time: '25:30' }).success).toBe(false);
    });

    it('rejects negative capacity via createSlotBodySchema', () => {
      expect(
        createSlotBodySchema.safeParse({
          start_time: '2026-03-07T08:00:00.000Z',
          end_time: '2026-03-07T08:30:00.000Z',
          capacity: -1,
        }).success
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // createSlotBodySchema (POST /api/v1/station/slots)
  // ---------------------------------------------------------------------------
  describe('createSlotBodySchema', () => {
    it('accepts valid slot', () => {
      const r = createSlotBodySchema.safeParse({
        start_time: '2026-03-07T08:00:00.000Z',
        end_time: '2026-03-07T08:30:00.000Z',
        capacity: 2,
      });
      expect(r.success).toBe(true);
    });

    it('rejects start_time >= end_time', () => {
      expect(
        createSlotBodySchema.safeParse({
          start_time: '2026-03-07T08:30:00.000Z',
          end_time: '2026-03-07T08:00:00.000Z',
          capacity: 1,
        }).success
      ).toBe(false);
    });

    it('rejects capacity < 1', () => {
      expect(
        createSlotBodySchema.safeParse({
          start_time: '2026-03-07T08:00:00.000Z',
          end_time: '2026-03-07T08:30:00.000Z',
          capacity: 0,
        }).success
      ).toBe(false);
    });
  });

  describe('createSlotsBulkBodySchema', () => {
    it('accepts non-empty slots array', () => {
      const r = createSlotsBulkBodySchema.safeParse({
        slots: [
          { start_time: '2026-03-07T08:00:00.000Z', end_time: '2026-03-07T08:30:00.000Z', capacity: 1 },
        ],
      });
      expect(r.success).toBe(true);
    });

    it('rejects empty slots', () => {
      expect(createSlotsBulkBodySchema.safeParse({ slots: [] }).success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // generateSlotsBodySchema (POST /api/v1/station/slots/generate)
  // ---------------------------------------------------------------------------
  describe('generateSlotsBodySchema', () => {
    it('accepts date only', () => {
      expect(generateSlotsBodySchema.safeParse({ date: '2026-03-07' }).success).toBe(true);
    });

    it('accepts date and end_date', () => {
      expect(
        generateSlotsBodySchema.safeParse({ date: '2026-03-07', end_date: '2026-03-10' }).success
      ).toBe(true);
    });

    it('rejects end_date before date', () => {
      expect(
        generateSlotsBodySchema.safeParse({ date: '2026-03-10', end_date: '2026-03-07' }).success
      ).toBe(false);
    });

    it('rejects invalid date format', () => {
      expect(generateSlotsBodySchema.safeParse({ date: '03-07-2026' }).success).toBe(false);
    });

    it('rejects invalid calendar date', () => {
      expect(generateSlotsBodySchema.safeParse({ date: '2024-02-30' }).success).toBe(false);
    });

    it('rejects interval_minutes below 5 or above 120', () => {
      expect(generateSlotsBodySchema.safeParse({ date: '2026-03-07', interval_minutes: 4 }).success).toBe(false);
      expect(generateSlotsBodySchema.safeParse({ date: '2026-03-07', interval_minutes: 121 }).success).toBe(false);
    });

    it('accepts interval_minutes within range', () => {
      expect(generateSlotsBodySchema.safeParse({ date: '2026-03-07', interval_minutes: 5 }).success).toBe(true);
      expect(generateSlotsBodySchema.safeParse({ date: '2026-03-07', interval_minutes: 120 }).success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteSlotsBodySchema (DELETE /api/v1/station/slots)
  // ---------------------------------------------------------------------------
  describe('deleteSlotsBodySchema', () => {
    it('accepts ids array', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(deleteSlotsBodySchema.safeParse({ ids: [uuid] }).success).toBe(true);
    });

    it('rejects empty ids', () => {
      expect(deleteSlotsBodySchema.safeParse({ ids: [] }).success).toBe(false);
    });

    it('rejects non-UUID', () => {
      expect(deleteSlotsBodySchema.safeParse({ ids: ['not-uuid'] }).success).toBe(false);
    });
  });

  describe('slotIdParamSchema', () => {
    it('accepts valid UUID', () => {
      expect(slotIdParamSchema.safeParse({ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }).success).toBe(true);
    });

    it('rejects non-UUID (hostile)', () => {
      expect(slotIdParamSchema.safeParse({ id: 'x' }).success).toBe(false);
      expect(slotIdParamSchema.safeParse({ id: '123' }).success).toBe(false);
      expect(slotIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
    });
  });

  describe('deleteSlotsBodySchema strict', () => {
    it('rejects extra keys', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(deleteSlotsBodySchema.safeParse({ ids: [uuid], extra: true }).success).toBe(false);
    });
  });
});
