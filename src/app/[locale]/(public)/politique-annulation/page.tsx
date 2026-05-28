import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { BottomNav } from '@/components/layout/BottomNav';
import { LegalContentRenderer } from '@/components/pages/LegalContentRenderer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cancel_policy' });
  return { title: t('meta_title'), description: t('meta_desc') };
}

export default async function CancellationPolicyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'cancel_policy' });
  const safeLocale: 'fr' | 'en' = locale === 'en' ? 'en' : 'fr';
  return (
    <>
      <PublicNavbar />
      <main className="min-h-screen bg-[#FFEECA] dark:bg-[#001201] transition-colors">
        <LegalContentRenderer
          contentKey="politique_annulation"
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
