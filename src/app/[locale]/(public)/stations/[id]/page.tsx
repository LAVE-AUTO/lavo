import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StationDetail } from '@/components/stations/StationDetail';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'stations' });
  return { title: `LAVO — ${t('page_title')}` };
}

/**
 * Public station detail page.
 * Passes the station ID to the client StationDetail component for data fetching.
 */
export default async function StationDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#EDEDED] dark:bg-dark-bg">
      <StationDetail id={id} />
    </main>
  );
}
