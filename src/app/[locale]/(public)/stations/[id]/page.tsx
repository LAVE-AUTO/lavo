import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MOCK_STATIONS } from '@/data/stations-mock';
import { StationDetail } from '@/components/stations/StationDetail';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t       = await getTranslations({ locale, namespace: 'stations' });
  const station = MOCK_STATIONS.find((s) => s.id === id);
  const name    = station ? station.name : t('page_title');
  return {
    title: `LAVO — ${name}`,
    description: station?.description ?? t('page_subtitle'),
  };
}

/**
 * Public station detail page.
 * Reads station ID from async params and passes it to the client StationDetail.
 */
export default async function StationDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#EDEDED] dark:bg-[#1A2116] transition-colors">
      <StationDetail id={id} />
    </main>
  );
}
