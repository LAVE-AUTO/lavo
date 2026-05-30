/**
 * Sort criteria for GET /api/v1/stations. Multi-criteria: applied in array order.
 */
export const STATION_SORT_CRITERIA = [
  'slots_asc',
  'slots_desc',
  'name_asc',
  'name_desc',
  'rating_asc',
  'rating_desc',
  'total_ratings_asc',
  'total_ratings_desc',
  'completed_count_asc',
  'completed_count_desc',
  /** Distance from the user; only effective when both `near_lat` and `near_lng` are provided. */
  'distance_asc',
  'distance_desc',
] as const;

export type StationSortCriterion = (typeof STATION_SORT_CRITERIA)[number];

/**
 * Parses comma-separated sort string into an array of validated sort criteria.
 * Invalid tokens are skipped; returns empty array if none valid.
 */
export function parseStationSortString(value: string | undefined): StationSortCriterion[] {
  if (!value || typeof value !== 'string') return [];
  const tokens = value.split(',').map((s) => s.trim()).filter(Boolean);
  const set = new Set(STATION_SORT_CRITERIA);
  return tokens.filter((t): t is StationSortCriterion => set.has(t as StationSortCriterion));
}
