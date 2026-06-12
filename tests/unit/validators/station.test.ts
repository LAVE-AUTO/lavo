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
  stationInfoSchema,
  updateStationPromoQrSchema,
  stationConfigBodySchema,
  createSlotBodySchema,
  createSlotsBulkBodySchema,
  generateSlotsBodySchema,
  deleteSlotsBodySchema,
  slotIdParamSchema,
  createFormatBodySchema,
  updateFormatBodySchema,
  patchFormatBodySchema,
  formatIdParamSchema,
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
  // stationInfoSchema (step2 onboarding)
  // ---------------------------------------------------------------------------
  describe('stationInfoSchema (step2)', () => {
    const baseStep2 = {
      station_name: 'Test Station',
      address: '123 Main St',
      city: 'Paris',
      wash_post_count: 2,
    };
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    it('accepts wash_type_ids array with at least one valid UUID', () => {
      const r = stationInfoSchema.safeParse({ ...baseStep2, wash_type_ids: [uuid] });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.wash_type_ids).toEqual([uuid]);
    });

    it('accepts wash_type_ids with multiple UUIDs', () => {
      const uuid2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
      const r = stationInfoSchema.safeParse({ ...baseStep2, wash_type_ids: [uuid, uuid2] });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.wash_type_ids).toEqual([uuid, uuid2]);
    });

    it('rejects empty wash_type_ids', () => {
      const r = stationInfoSchema.safeParse({ ...baseStep2, wash_type_ids: [] });
      expect(r.success).toBe(false);
    });

    it('rejects when wash_type_ids is missing', () => {
      const r = stationInfoSchema.safeParse(baseStep2);
      expect(r.success).toBe(false);
    });

    it('rejects when one id is not a valid UUID', () => {
      const r = stationInfoSchema.safeParse({ ...baseStep2, wash_type_ids: [uuid, 'not-a-uuid'] });
      expect(r.success).toBe(false);
    });

    it('rejects wash_type_ids with more than 50 elements', () => {
      const ids = Array(51).fill(uuid);
      const r = stationInfoSchema.safeParse({ ...baseStep2, wash_type_ids: ids });
      expect(r.success).toBe(false);
    });

    it('accepts optional service_scope (exterior, interior, both)', () => {
      const withExterior = stationInfoSchema.safeParse({ ...baseStep2, wash_type_ids: [uuid], service_scope: 'exterior' });
      expect(withExterior.success).toBe(true);
      if (withExterior.success) expect(withExterior.data.service_scope).toBe('exterior');
      const withBoth = stationInfoSchema.safeParse({ ...baseStep2, wash_type_ids: [uuid], service_scope: 'both' });
      expect(withBoth.success).toBe(true);
      if (withBoth.success) expect(withBoth.data.service_scope).toBe('both');
    });

    it('accepts step2 without service_scope (optional)', () => {
      const r = stationInfoSchema.safeParse({ ...baseStep2, wash_type_ids: [uuid] });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.service_scope).toBeUndefined();
    });

    it('rejects invalid service_scope', () => {
      const r = stationInfoSchema.safeParse({ ...baseStep2, wash_type_ids: [uuid], service_scope: 'invalid' });
      expect(r.success).toBe(false);
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

    it('accepts valid sort values (single and comma-separated)', () => {
      expect(listStationsQuerySchema.safeParse({ sort: 'name_asc' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ sort: 'name_desc' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ sort: 'slots_asc' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ sort: 'slots_desc' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ sort: 'rating_asc,rating_desc' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ sort: 'completed_count_desc,name_asc' }).success).toBe(true);
    });

    it('rejects invalid sort value', () => {
      const r = listStationsQuerySchema.safeParse({ sort: 'invalid_sort' });
      expect(r.success).toBe(false);
    });

    it('rejects invalid token in comma-separated sort', () => {
      expect(listStationsQuerySchema.safeParse({ sort: 'name_asc,bad' }).success).toBe(false);
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

    it('accepts groups (comma-separated)', () => {
      const r = listStationsQuerySchema.safeParse({ groups: 'available_now,most_visited' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.groups).toEqual(['available_now', 'most_visited']);
    });

    it('rejects invalid group token in groups', () => {
      expect(listStationsQuerySchema.safeParse({ groups: 'available_now,invalid' }).success).toBe(false);
      expect(listStationsQuerySchema.safeParse({ groups: 'unknown' }).success).toBe(false);
    });

    it('dedupes duplicate group tokens in groups', () => {
      const r = listStationsQuerySchema.safeParse({ groups: 'available_now,available_now,most_visited' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.groups).toEqual(['available_now', 'most_visited']);
    });

    it('accepts page and per_page', () => {
      const r = listStationsQuerySchema.safeParse({ page: '1', per_page: '20' });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.page).toBe(1);
        expect(r.data.per_page).toBe(20);
      }
    });

    it('rejects page < 1 or > 10000', () => {
      expect(listStationsQuerySchema.safeParse({ page: '0' }).success).toBe(false);
      expect(listStationsQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
      expect(listStationsQuerySchema.safeParse({ page: '10001' }).success).toBe(false);
    });

    it('rejects per_page over 100', () => {
      expect(listStationsQuerySchema.safeParse({ per_page: '101' }).success).toBe(false);
    });

    it('rejects limit_per_group < 1 or > 100', () => {
      expect(listStationsQuerySchema.safeParse({ limit_per_group: '0' }).success).toBe(false);
      expect(listStationsQuerySchema.safeParse({ limit_per_group: '101' }).success).toBe(false);
    });

    it('accepts limit_per_group, wash_type_ids, service_scope, format_id', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const r = listStationsQuerySchema.safeParse({
        limit_per_group: '5',
        wash_type_ids: uuid,
        service_scope: 'exterior',
        format_id: uuid,
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.limit_per_group).toBe(5);
        expect(r.data.wash_type_ids).toEqual([uuid]);
        expect(r.data.service_scope).toBe('exterior');
        expect(r.data.format_id).toBe(uuid);
      }
    });

    it('accepts service_scope exterior, interior, and both', () => {
      expect(listStationsQuerySchema.safeParse({ service_scope: 'exterior' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ service_scope: 'interior' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ service_scope: 'both' }).success).toBe(true);
    });

    it('transforms empty service_scope to undefined', () => {
      const r = listStationsQuerySchema.safeParse({ service_scope: '' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.service_scope).toBeUndefined();
    });

    it('rejects invalid service_scope', () => {
      expect(listStationsQuerySchema.safeParse({ service_scope: 'invalid' }).success).toBe(false);
    });

    it('rejects invalid format_id (non-UUID)', () => {
      expect(listStationsQuerySchema.safeParse({ format_id: 'x' }).success).toBe(false);
    });

    it('rejects wash_type_ids when one token is not a UUID', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(listStationsQuerySchema.safeParse({ wash_type_ids: `${uuid},not-a-uuid` }).success).toBe(false);
      expect(listStationsQuerySchema.safeParse({ wash_type_ids: 'x,y' }).success).toBe(false);
    });

    it('accepts valid date YYYY-MM-DD', () => {
      expect(listStationsQuerySchema.safeParse({ date: '2026-03-08' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ date: '2024-01-01' }).success).toBe(true);
    });

    it('rejects invalid calendar date', () => {
      expect(listStationsQuerySchema.safeParse({ date: '2024-02-30' }).success).toBe(false);
      expect(listStationsQuerySchema.safeParse({ date: '2023-13-01' }).success).toBe(false);
    });

    it('rejects date with wrong format', () => {
      expect(listStationsQuerySchema.safeParse({ date: '03-08-2026' }).success).toBe(false);
      expect(listStationsQuerySchema.safeParse({ date: '2026/03/08' }).success).toBe(false);
    });

    it('accepts per_page 1 and 100 (boundaries)', () => {
      expect(listStationsQuerySchema.safeParse({ per_page: '1' }).success).toBe(true);
      expect(listStationsQuerySchema.safeParse({ per_page: '100' }).success).toBe(true);
      const r1 = listStationsQuerySchema.safeParse({ per_page: '1' });
      const r100 = listStationsQuerySchema.safeParse({ per_page: '100' });
      if (r1.success) expect(r1.data.per_page).toBe(1);
      if (r100.success) expect(r100.data.per_page).toBe(100);
    });
  });

  describe('updateStationPromoQrSchema', () => {
    const futureIso = new Date(Date.now() + 86_400_000).toISOString();

    it('accepts commission rates up to 100%', () => {
      expect(updateStationPromoQrSchema.safeParse({
        commission_rate_percent: 100,
        expires_at: futureIso,
      }).success).toBe(true);

      expect(updateStationPromoQrSchema.safeParse({
        commission_rate_percent: 50.5,
        expires_at: futureIso,
      }).success).toBe(true);
    });

    it('rejects commission rates above 100%', () => {
      expect(updateStationPromoQrSchema.safeParse({
        commission_rate_percent: 100.5,
        expires_at: futureIso,
      }).success).toBe(false);
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

  // ---------------------------------------------------------------------------
  // Vehicle format validators
  // ---------------------------------------------------------------------------
  describe('formatIdParamSchema', () => {
    it('accepts valid UUID', () => {
      expect(formatIdParamSchema.safeParse({ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }).success).toBe(true);
    });
    it('rejects non-UUID', () => {
      expect(formatIdParamSchema.safeParse({ id: 'x' }).success).toBe(false);
    });
  });

  describe('createFormatBodySchema', () => {
    it('accepts label, price, optional is_active', () => {
      const r = createFormatBodySchema.safeParse({ label: 'SUV', price: 25.5 });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.is_active).toBe(true);
      }
    });
    it('rejects empty label', () => {
      expect(createFormatBodySchema.safeParse({ label: '', price: 10 }).success).toBe(false);
    });
    it('rejects price <= 0', () => {
      expect(createFormatBodySchema.safeParse({ label: 'X', price: 0 }).success).toBe(false);
      expect(createFormatBodySchema.safeParse({ label: 'X', price: -1 }).success).toBe(false);
    });
    it('rejects label over 100 chars', () => {
      expect(createFormatBodySchema.safeParse({ label: 'a'.repeat(101), price: 10 }).success).toBe(false);
    });
  });

  describe('updateFormatBodySchema', () => {
    it('requires label, price, is_active', () => {
      expect(updateFormatBodySchema.safeParse({ label: 'X', price: 10, is_active: true }).success).toBe(true);
      expect(updateFormatBodySchema.safeParse({ label: 'X', price: 10 }).success).toBe(false);
    });
  });

  describe('patchFormatBodySchema', () => {
    it('accepts at least one field', () => {
      expect(patchFormatBodySchema.safeParse({ price: 15 }).success).toBe(true);
      expect(patchFormatBodySchema.safeParse({ is_active: false }).success).toBe(true);
    });
    it('rejects empty object', () => {
      expect(patchFormatBodySchema.safeParse({}).success).toBe(false);
    });
  });
});
