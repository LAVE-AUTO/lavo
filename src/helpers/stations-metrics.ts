import type { StationListPublicItem } from '@/server/station/station-service';

export interface StationsHeroMetrics {
  totalStations:     number;
  availableStations: number;
  cities:            number;
  totalReviews:      number;
  completedCount:    number;
  /** Weighted by total_ratings; null when no rating exists yet. */
  avgRating:         number | null;
}

export function computeStationsHeroMetrics(
  stations: StationListPublicItem[],
  total: number,
): StationsHeroMetrics {
  const availableStations = stations.filter((s) => s.available).length;
  const cities            = new Set(stations.map((s) => s.city)).size;
  const totalReviews      = stations.reduce((acc, s) => acc + (s.total_ratings || 0), 0);
  const completedCount    = stations.reduce((acc, s) => acc + (s.completed_count ?? 0), 0);

  let weightedSum = 0;
  let weight      = 0;
  for (const s of stations) {
    const score = s.average_score != null ? parseFloat(String(s.average_score)) : NaN;
    const count = s.total_ratings || 0;
    if (!isNaN(score) && count > 0) {
      weightedSum += score * count;
      weight      += count;
    }
  }
  const avgRating = weight > 0 ? weightedSum / weight : null;

  return {
    totalStations: total,
    availableStations,
    cities,
    totalReviews,
    completedCount,
    avgRating,
  };
}
