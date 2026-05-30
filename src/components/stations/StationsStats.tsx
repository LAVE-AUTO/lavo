import { getLocale } from 'next-intl/server';
import type { StationsHeroMetrics } from '@/helpers/stations-metrics';

interface StationsStatsProps {
  metrics: StationsHeroMetrics;
}

function StatItem({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-4">
      <span className={`text-[22px] font-black ${accent ? 'text-gold' : 'text-[#000000] dark:text-white'}`}>
        {value}
      </span>
      <span className="text-[14px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mt-0.5">
        {label}
      </span>
    </div>
  );
}

/**
 * Stats bar between the hero and the station list.
 * Server component; metrics are precomputed by the page so hero + stats share
 * a single DB round-trip via `computeStationsHeroMetrics`.
 */
export async function StationsStats({ metrics }: StationsStatsProps) {
  const locale = await getLocale();
  const isFr   = locale === 'fr';

  return (
    <div className="bg-[#C8C8B4] dark:bg-surface border-b border-[#CCCCCC] dark:border-border transition-colors" id="stations-list">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#CCCCCC] dark:divide-[#2C3828]">
          <StatItem
            value={metrics.totalStations.toLocaleString()}
            label={isFr ? 'Stations' : 'Stations'}
          />
          <StatItem
            value={metrics.availableStations.toLocaleString()}
            label={isFr ? 'Disponibles' : 'Available'}
            accent
          />
          <StatItem
            value={metrics.cities.toLocaleString()}
            label={isFr ? 'Villes' : 'Cities'}
          />
          <StatItem
            value={`${metrics.totalReviews.toLocaleString()}${metrics.totalReviews > 0 ? '+' : ''}`}
            label={isFr ? 'Avis clients' : 'Reviews'}
          />
        </div>
      </div>
    </div>
  );
}
