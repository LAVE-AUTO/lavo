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
  stationApplyFieldsSchema,
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
  // stationApplyFieldsSchema (POST /api/v1/stations/apply multipart fields)
  // ---------------------------------------------------------------------------
  const validApplyFields = {
    name: 'Station Alpha',
    address: '10 Rue de la Paix',
    city: 'Paris',
    wash_type: 'hand_wash',
    wash_post_count: 4,
    terms_accepted: 'true',
  };

  describe('stationApplyFieldsSchema', () => {
    it('accepts valid fields (name, address, city, wash_type, wash_post_count, terms_accepted)', () => {
      const r = stationApplyFieldsSchema.safeParse(validApplyFields);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.name).toBe('Station Alpha');
        expect(r.data.address).toBe('10 Rue de la Paix');
        expect(r.data.city).toBe('Paris');
        expect(r.data.wash_type).toBe('hand_wash');
        expect(r.data.wash_post_count).toBe(4);
        expect(r.data.terms_accepted).toBe(true);
      }
    });

    it('accepts optional legal_name, registration_number, description', () => {
      const r = stationApplyFieldsSchema.safeParse({
        ...validApplyFields,
        legal_name: 'Alpha SARL',
        registration_number: 'FR123',
        description: 'Nice station',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.legal_name).toBe('Alpha SARL');
        expect(r.data.registration_number).toBe('FR123');
        expect(r.data.description).toBe('Nice station');
      }
    });

    it('rejects missing required (name)', () => {
      const { name: _, ...rest } = validApplyFields;
      expect(stationApplyFieldsSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects missing required (address)', () => {
      const { address: _, ...rest } = validApplyFields;
      expect(stationApplyFieldsSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects invalid wash_type', () => {
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          wash_type: 'invalid',
        }).success
      ).toBe(false);
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          wash_type: 'automatic_wash',
        }).success
      ).toBe(false);
    });

    it('rejects terms_accepted false or not "true"/"1"', () => {
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          terms_accepted: 'false',
        }).success
      ).toBe(false);
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          terms_accepted: '',
        }).success
      ).toBe(false);
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          terms_accepted: 'yes',
        }).success
      ).toBe(false);
    });

    it('accepts terms_accepted "1"', () => {
      const r = stationApplyFieldsSchema.safeParse({
        ...validApplyFields,
        terms_accepted: '1',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.terms_accepted).toBe(true);
    });

    it('rejects wash_post_count < 1', () => {
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          wash_post_count: 0,
        }).success
      ).toBe(false);
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          wash_post_count: -1,
        }).success
      ).toBe(false);
    });

    it('rejects wash_post_count > 100', () => {
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          wash_post_count: 101,
        }).success
      ).toBe(false);
    });

    it('accepts wash_post_count 1 and 100', () => {
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          wash_post_count: 1,
        }).success
      ).toBe(true);
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          wash_post_count: 100,
        }).success
      ).toBe(true);
    });

    it('rejects address over 500 characters', () => {
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          address: 'a'.repeat(501),
        }).success
      ).toBe(false);
    });

    it('accepts address at exactly 500 characters', () => {
      expect(
        stationApplyFieldsSchema.safeParse({
          ...validApplyFields,
          address: 'a'.repeat(500),
        }).success
      ).toBe(true);
    });
  });
});
