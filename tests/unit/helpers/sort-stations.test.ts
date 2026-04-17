/**
 * Unit tests for parseStationSortString (GET /api/v1/stations sort param).
 */
import { parseStationSortString, STATION_SORT_CRITERIA } from '@/helpers/sort-stations';

describe('sort-stations', () => {
  describe('parseStationSortString', () => {
    it('returns empty array for undefined', () => {
      expect(parseStationSortString(undefined)).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(parseStationSortString('')).toEqual([]);
    });

    it('returns empty array for whitespace-only string', () => {
      expect(parseStationSortString('   ')).toEqual([]);
    });

    it('returns single criterion for valid token', () => {
      expect(parseStationSortString('name_asc')).toEqual(['name_asc']);
      expect(parseStationSortString('slots_desc')).toEqual(['slots_desc']);
      expect(parseStationSortString('rating_asc')).toEqual(['rating_asc']);
      expect(parseStationSortString('completed_count_desc')).toEqual(['completed_count_desc']);
    });

    it('returns multiple criteria in order for comma-separated valid tokens', () => {
      expect(parseStationSortString('rating_desc,name_asc')).toEqual(['rating_desc', 'name_asc']);
      expect(parseStationSortString('slots_asc,slots_desc,name_asc')).toEqual([
        'slots_asc',
        'slots_desc',
        'name_asc',
      ]);
    });

    it('trims whitespace around tokens', () => {
      expect(parseStationSortString('  name_asc  ')).toEqual(['name_asc']);
      expect(parseStationSortString('rating_desc , name_asc')).toEqual(['rating_desc', 'name_asc']);
    });

    it('skips invalid tokens and returns only valid ones', () => {
      expect(parseStationSortString('name_asc,invalid_sort,name_desc')).toEqual(['name_asc', 'name_desc']);
    });

    it('returns empty array when all tokens invalid', () => {
      expect(parseStationSortString('invalid,bad,unknown')).toEqual([]);
    });

    it('recognizes all STATION_SORT_CRITERIA', () => {
      const all = STATION_SORT_CRITERIA.join(',');
      const result = parseStationSortString(all);
      expect(result).toEqual([...STATION_SORT_CRITERIA]);
    });

    it('handles malformed input: non-string is treated as undefined', () => {
      expect(parseStationSortString(null as unknown as string)).toEqual([]);
    });
  });
});
