import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { LegalContentRenderer } from '@/components/pages/LegalContentRenderer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cgu_page' });
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: {
      canonical: `/${locale}/cgu`,
      languages: {
        fr: '/fr/cgu',
        en: '/en/cgu',
      },
    },
  };
}

export default async function CguPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'cgu_page' });
  const safeLocale: 'fr' | 'en' = locale === 'en' ? 'en' : 'fr';

  return (
    <>
      <PublicNavbar />
      <main className="min-h-screen bg-[#FFEECA] dark:bg-dark-bg transition-colors">
        <LegalContentRenderer
          contentKey="cgu"
          locale={safeLocale}
          eyebrow={t('eyebrow')}
          title={t('title')}
          updated={t('updated')}
          questions={t('questions')}
          contactBtn={t('contact_btn')}
        />
      </main>
      <BottomNav />
    </>
  );
}
