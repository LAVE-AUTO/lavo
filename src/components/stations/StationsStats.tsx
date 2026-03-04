import { getLocale } from 'next-intl/server';
import { MOCK_STATIONS } from '@/data/stations-mock';

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
    <div className="flex flex-col items-center text-center px-6 py-5">
      <span className={`text-[28px] font-black ${accent ? 'text-gold' : 'text-[#1A1A1A] dark:text-white'}`}>
        {value}
      </span>
      <span className="text-[12px] font-semibold text-lavo-muted uppercase tracking-wider mt-0.5">
        {label}
      </span>
    </div>
  );
}

/**
 * Stats bar between the hero and the station list.
 * Shows live counts derived from mock data.
 * Server component.
 */
export async function StationsStats() {
  const locale = await getLocale();
  const isFr   = locale === 'fr';

  const total     = MOCK_STATIONS.length;
  const available = MOCK_STATIONS.filter((s) => s.availableSlots > 0).length;
  const cities    = [...new Set(MOCK_STATIONS.map((s) => s.city))].length;
  const reviews   = MOCK_STATIONS.reduce((acc, s) => acc + s.reviewCount, 0);

  return (
    <div className="bg-white dark:bg-dark-card border-b border-[#E0E0D0] dark:border-[#2C3828]" id="stations-list">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#E0E0D0] dark:divide-[#2C3828]">
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
