import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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
    title: `LAVO — ${t('page_title')}`,
    description: t('page_subtitle'),
  };
}

/**
 * Public station list page.
 * Hero section + stats + client-side searchable station grid.
 */
export default async function PublicStationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#EDEDED] dark:bg-dark-bg transition-colors">
      <AuthAwareHero>
        <StationsHero />
        <StationsStats />
      </AuthAwareHero>

      <section id="stations-list" className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <Suspense fallback={<div className="py-20 text-center text-[#333333] dark:text-[#C0C0B0]">Chargement…</div>}>
          <StationListView />
        </Suspense>
      </section>
    </main>
  );
}