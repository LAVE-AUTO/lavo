import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StationListView } from '@/components/stations/StationListView';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'stations' });
  return { title: `LAVO — ${t('page_title')}` };
}

/**
 * Public station list page.
 * Renders the client-side StationListView which fetches and filters stations.
 */
export default async function PublicStationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'stations' });

  return (
    <main className="min-h-screen bg-[#EDEDED] dark:bg-dark-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <h1 className="text-[26px] sm:text-[32px] font-black text-[#1A1A1A] dark:text-white mb-1">
            {t('page_title')}
          </h1>
          <p className="text-[14px] text-lavo-muted">{t('page_subtitle')}</p>
        </header>

        <StationListView />
      </div>
    </main>
  );
}
