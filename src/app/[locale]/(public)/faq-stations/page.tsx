import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { BottomNav } from '@/components/layout/BottomNav';
import { FaqPageContent } from '@/components/pages/FaqPageContent';
import { getLegalContent } from '@/server/admin/legal-content-service';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'faq_stations_page' });
  return { title: t('meta_title'), description: t('meta_desc') };
}

export default async function FaqStationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'faq_stations_page' });
  const safeLocale: 'fr' | 'en' = locale === 'en' ? 'en' : 'fr';
  const html = (await getLegalContent('landing_faq_stations', { withDefault: true, locale: safeLocale })) ?? '';

  return (
    <>
      <PublicNavbar />
      <main className="min-h-screen bg-[#FFEECA] dark:bg-dark-bg transition-colors">
        <FaqPageContent
          html={html}
          eyebrow={t('eyebrow')}
          title={t('title')}
          titleAccent={t('title_accent')}
          subtitle={t('subtitle')}
          ctaTitle={t('cta_title')}
          ctaDesc={t('cta_desc')}
          ctaBtn={t('cta_btn')}
        />
      </main>
      <div className="hidden sm:block"><PublicFooter /></div>
      <BottomNav />
    </>
  );
}
