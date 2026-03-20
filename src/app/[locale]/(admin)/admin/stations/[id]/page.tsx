import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminStationDetail } from '@/components/admin/AdminStationDetail';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin_stations' });
  return { title: `LAVO Admin — ${t('detail_title')}` };
}

export default async function AdminStationDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#EDEDED] dark:bg-[#1A2116] p-6">
      <AdminStationDetail id={id} />
    </main>
  );
}
