import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { BottomNav } from '@/components/layout/BottomNav';
import { ContactContent } from '@/components/pages/ContactContent';
import { getLegalContent } from '@/server/admin/legal-content-service';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact_page' });
  return { title: t('meta_title'), description: t('meta_desc') };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'contact_page' });
  const safeLocale: 'fr' | 'en' = locale === 'en' ? 'en' : 'fr';
  const html = (await getLegalContent('contact', { withDefault: true, locale: safeLocale })) ?? '';

  return (
    <>
      <PublicNavbar />
      <main className="min-h-screen bg-[#FFEECA] dark:bg-[#001201] transition-colors">
        <ContactContent
          html={html}
          eyebrow={t('eyebrow')}
          title={t('title')}
        />
      </main>
      <div className="hidden sm:block"><PublicFooter /></div>
      <BottomNav />
    </>
  );
}
