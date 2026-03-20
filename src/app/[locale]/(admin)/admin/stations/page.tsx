import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PendingStationsList } from '@/components/admin/PendingStationsList';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin_stations' });
  return { title: `LAVO Admin — ${t('page_title')}` };
}

export default async function AdminStationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'admin_stations' });

  return (
    <main className="min-h-screen bg-[#EDEDED] dark:bg-[#1A2116] p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
          <p className="mt-0.5 text-[13px] text-[#888] dark:text-[#6A6A5A]">{t('page_subtitle')}</p>
        </div>
        <PendingStationsList />
      </div>
    </main>
  );
}
