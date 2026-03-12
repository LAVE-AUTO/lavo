import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { BottomNav } from '@/components/layout/BottomNav';
import { CancellationPolicyContent } from '@/components/pages/CancellationPolicyContent';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cancel_policy' });
  return { title: t('meta_title'), description: t('meta_desc') };
}

export default async function CancellationPolicyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <PublicNavbar />
      <main className="min-h-screen bg-[#F7F3EC] dark:bg-[#0d1f0f] transition-colors">
        <CancellationPolicyContent />
      </main>
      <div className="hidden sm:block"><PublicFooter /></div>
      <BottomNav />
    </>
  );
}
