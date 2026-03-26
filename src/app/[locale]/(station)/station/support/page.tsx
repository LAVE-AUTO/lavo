import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClientSupportContainer } from '@/components/support/client/ClientSupportContainer';
import { MOCK_STATION_TICKETS } from '@/components/support/support-mock';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'station_support' });
  return { title: `Slowtime — ${t('page_title')}` };
}

export default async function StationSupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'station_support' });

  // TODO: replace mock with server-side getFromApi('/station/tickets') once endpoint is available
  return (
    <ClientSupportContainer
      tickets={MOCK_STATION_TICKETS}
      sectionLabel={t('section_title')}
    />
  );
}
