import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClientSupportContainer } from '@/components/support/client/ClientSupportContainer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'station_support' });
  return { title: `Slowtime - ${t('page_title')}` };
}

export default async function StationSupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'station_support' });

  return (
    <ClientSupportContainer sectionLabel={t('section_title')} />
  );
}
