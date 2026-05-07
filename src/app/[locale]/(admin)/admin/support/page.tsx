import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminSupportContainer } from '@/components/admin/support/AdminSupportContainer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin_support' });
  return { title: `Slowtime - ${t('page_title')}` };
}

export default async function AdminSupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminSupportContainer />;
}
