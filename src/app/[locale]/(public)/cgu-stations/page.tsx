import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { BottomNav } from '@/components/layout/BottomNav';
import { LegalContentRenderer } from '@/components/pages/LegalContentRenderer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cgu_stations_page' });
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: {
      canonical: `/${locale}/cgu-stations`,
      languages: {
        fr: '/fr/cgu-stations',
        en: '/en/cgu-stations',
      },
    },
  };
}

export default async function CguStationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'cgu_stations_page' });
  const safeLocale: 'fr' | 'en' = locale === 'en' ? 'en' : 'fr';
  return (
    <>
      <PublicNavbar />
      <main className="min-h-screen bg-[#F7F3EC] dark:bg-[#0d1f0f] transition-colors">
        <LegalContentRenderer
          contentKey="cgu_stations"
          locale={safeLocale}
          eyebrow={t('eyebrow')}
          title={t('title')}
          updated={t('updated')}
          questions={t('questions')}
          contactBtn={t('contact_btn')}
        />
      </main>
      <div className="hidden sm:block"><PublicFooter /></div>
      <BottomNav />
    </>
  );
}
