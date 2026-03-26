import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClientSupportContainer } from '@/components/support/client/ClientSupportContainer';
import { MOCK_MY_TICKETS } from '@/components/support/support-mock';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'client_support' });
  return { title: `Slowtime — ${t('page_title')}` };
}

export default async function ClientSupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  // TODO: replace mock with server-side getFromApi('/me/tickets') once endpoint is available
  return <ClientSupportContainer tickets={MOCK_MY_TICKETS} />;
}
