import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { BottomNav } from '@/components/layout/BottomNav';
import { SupportContent } from '@/components/pages/SupportContent';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'support_page' });
  return { title: t('meta_title'), description: t('meta_desc') };
}

export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <PublicNavbar />
      <main className="min-h-screen bg-[#FFEECA] dark:bg-[#001201] transition-colors">
        <SupportContent />
      </main>
      <div className="hidden sm:block"><PublicFooter /></div>
      <BottomNav />
    </>
  );
}
