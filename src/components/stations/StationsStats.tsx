import { getLocale } from 'next-intl/server';
import { listStationsPublic } from '@/server/station/station-service';

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
 * Dark design matching the HTML mockup's filter-bar / results-header aesthetic.
 * Server component.
 */
export async function StationsStats() {
  const locale = await getLocale();
  const isFr   = locale === 'fr';

  let total = 0;
  let available = 0;
  let cities = 0;
  let reviews = 0;

  try {
    const result = await listStationsPublic({ per_page: 200 });
    const stations = result.data.all;
    total = result.meta.total;
    available = stations.filter((s) => s.available).length;
    cities = new Set(stations.map((s) => s.city)).size;
    reviews = stations.reduce((acc, s) => acc + (s.total_ratings || 0), 0);
  } catch {
    // fallback to zeros on error
  }

  return (
    <div className="bg-[#C8C8B4] dark:bg-dark-card border-b border-[#CCCCCC] dark:border-tab-inactive transition-colors" id="stations-list">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#CCCCCC] dark:divide-[#2C3828]">
          <StatItem
            value={`${total}`}
            label={isFr ? 'Stations' : 'Stations'}
          />
          <StatItem
            value={`${available}`}
            label={isFr ? 'Disponibles' : 'Available'}
            accent
          />
          <StatItem
            value={`${cities}`}
            label={isFr ? 'Villes' : 'Cities'}
          />
          <StatItem
            value={`${reviews}+`}
            label={isFr ? 'Avis clients' : 'Reviews'}
          />
        </div>
      </div>
    </div>
  );
}
