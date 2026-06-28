import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { washTypes } from '@/lib/db/schema';
import { listStationsPublic } from '@/server/station/station-service';
import { getAllFormats } from '@/server/station/format-service';
import { computeStationsHeroMetrics, type StationsHeroMetrics } from '@/helpers/stations-metrics';
import { StationListView } from '@/components/stations/StationListView';
import { StationsHero } from '@/components/stations/StationsHero';
import { StationsStats } from '@/components/stations/StationsStats';
import { AuthAwareHero } from '@/components/stations/AuthAwareHero';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'stations' });
  return {
    title: `Hurryline - ${t('page_title')}`,
    description: t('page_subtitle'),
  };
}

const EMPTY_METRICS: StationsHeroMetrics = {
  totalStations:    0,
  availableStations: 0,
  cities:           0,
  totalReviews:     0,
  completedCount:   0,
  avgRating:        null,
};

/**
 * Public station list page.
 * Loads the active wash types + a single `listStationsPublic` call so the
 * hero/stats bar can render real metrics (no duplicate DB round-trip).
 * The list itself is fetched client-side with the selected filters forwarded
 * as query params to GET /stations.
 */
export default async function PublicStationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'stations' });

  const [activeWashTypes, formats] = await Promise.all([
    db
      .select({ id: washTypes.id, code: washTypes.code, label: washTypes.label })
      .from(washTypes)
      .where(eq(washTypes.is_active, true))
      .orderBy(washTypes.sort_order),
    getAllFormats(),
  ]);
  const vehicleFormats = formats
    .filter((f, i, arr) => arr.findIndex((x) => x.label === f.label) === i)
    .map((f) => ({ id: f.id, label: f.label }));

  let heroMetrics: StationsHeroMetrics = EMPTY_METRICS;
  try {
    const result = await listStationsPublic({ per_page: 200 });
    heroMetrics = computeStationsHeroMetrics(result.data.all, result.meta.total);
  } catch {
    heroMetrics = EMPTY_METRICS;
  }

  return (
    <main className="min-h-screen bg-[#FFF9EC] dark:bg-background transition-colors">
      <h1 className="sr-only">{t('page_title')}</h1>
      <AuthAwareHero>
        <StationsHero metrics={heroMetrics} />
        <StationsStats metrics={heroMetrics} />
      </AuthAwareHero>

      <section id="stations-list" className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <Suspense fallback={<div className="py-20 text-center text-[#333333] dark:text-[#C0C0B0]">Chargement…</div>}>
          <StationListView washTypes={activeWashTypes} vehicleFormats={vehicleFormats} />
        </Suspense>
      </section>
    </main>
  );
}