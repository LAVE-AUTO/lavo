import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClientHistoryView } from '@/components/history/ClientHistoryView';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'history' });
  return { title: `LAVO - ${t('title')}` };
}

export default async function ClientHistoryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'history' });

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-dark-bg pb-24 sm:pb-8">
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <h1 className="text-[22px] font-black text-[#0A0A14] dark:text-white">{t('title')}</h1>
        <p className="text-[14px] text-[#666] dark:text-[#B0B0A0] mt-1">{t('subtitle')}</p>
      </div>
      <div className="px-4 max-w-2xl mx-auto">
        <ClientHistoryView />
      </div>
    </main>
  );
}
