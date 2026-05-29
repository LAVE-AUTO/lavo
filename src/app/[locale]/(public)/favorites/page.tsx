'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { fetchStations } from '@/services/station-api';
import { useFavorites } from '@/components/stations/useFavorites';
import { StationCard } from '@/components/stations/StationCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/PageSpinner';

export default function FavoritesPage() {
  const t = useTranslations('favorites');
  const { favoriteIds } = useFavorites();
  const [stations, setStations] = useState<Awaited<ReturnType<typeof fetchStations>>['stations']>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await fetchStations();
      if (cancelled) return;
      setStations(result.stations);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const favorites = useMemo(
    () => stations.filter((station) => favoriteIds.includes(station.id)),
    [stations, favoriteIds],
  );

  if (loading) {
    return <PageSpinner py="py-24" />;
  }

  return (
    <main className="min-h-screen bg-background pb-24 sm:pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <h1 className="text-[22px] font-black text-foreground">{t('title')}</h1>
        <p className="text-[14px] text-foreground/65 mt-1">{t('subtitle')}</p>
      </div>

      <div className="px-4 max-w-2xl mx-auto">
        {favorites.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {favorites.map((station) => (
              <StationCard key={station.id} station={station} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={t('empty_title')}
            description={t('empty_desc')}
            action={
              <Link
                href="/stations"
                className="inline-flex items-center justify-center rounded-xl bg-gold px-5 py-3 text-[14px] font-black text-dark-bg transition-colors hover:bg-gold-hover"
              >
                {t('explore_stations')}
              </Link>
            }
          />
        )}
      </div>
    </main>
  );
}
