import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getStationDetailPublic } from '@/server/station/station-service';
import { StationDetail } from '@/components/stations/StationDetail';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'stations' });
  let name = t('page_title');
  let description = t('page_subtitle');
  try {
    const station = await getStationDetailPublic(id);
    if (station) {
      name = station.name;
      if (station.description) description = station.description;
    }
  } catch {
    // fallback to defaults
  }
  return {
    title: `LAVO — ${name}`,
    description,
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
    <main className="min-h-screen bg-[#EDEDED] dark:bg-dark-bg transition-colors">
      <StationDetail id={id} />
    </main>
  );
}
