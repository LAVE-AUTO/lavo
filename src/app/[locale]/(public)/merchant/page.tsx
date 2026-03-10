import { setRequestLocale, getTranslations } from 'next-intl/server';
import { MerchantNavbar } from '@/components/merchant/MerchantNavbar';
import { MerchantHeroSection } from '@/components/merchant/MerchantHeroSection';
import { MerchantMarqueeBanner } from '@/components/merchant/MerchantMarqueeBanner';
import { MerchantProblemSection } from '@/components/merchant/MerchantProblemSection';
import { MerchantHowItWorksSection } from '@/components/merchant/MerchantHowItWorksSection';
import { MerchantFeaturesSection } from '@/components/merchant/MerchantFeaturesSection';
import { MerchantQrSection } from '@/components/merchant/MerchantQrSection';
import { MerchantTestimonialsSection } from '@/components/merchant/MerchantTestimonialsSection';
import { MerchantCtaSection } from '@/components/merchant/MerchantCtaSection';
import { MerchantFooter } from '@/components/merchant/MerchantFooter';
import { BottomNav } from '@/components/layout/BottomNav';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'merchant' });
  return { title: t('meta_title'), description: t('meta_desc') };
}

export default async function MerchantPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <MerchantNavbar />
      <main className="min-h-screen bg-[#EDEDED] dark:bg-[#0d1f0f] transition-colors">
        <MerchantHeroSection />
        <MerchantMarqueeBanner />
        <MerchantProblemSection />
        <MerchantHowItWorksSection />
        <MerchantFeaturesSection />
        <MerchantQrSection />
        <MerchantTestimonialsSection />
        <MerchantCtaSection />
      </main>
      <div className="hidden sm:block">
        <MerchantFooter />
      </div>
      <BottomNav />
    </>
  );
}
