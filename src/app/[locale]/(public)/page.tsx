import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingService } from '@/components/landing/LandingService';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingStats } from '@/components/landing/LandingStats';
import { LandingTestimonials } from '@/components/landing/LandingTestimonials';
import { LandingMerchantCTA } from '@/components/landing/LandingMerchantCTA';
import { LandingFinalCTA } from '@/components/landing/LandingFinalCTA';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <PublicNavbar />
      <main>
        <LandingHero />
        <LandingService />
        <HowItWorks />
        <LandingFeatures />
        <LandingStats />
        <LandingTestimonials />
        <LandingMerchantCTA />
        <LandingFinalCTA />
      </main>
      <PublicFooter />
    </>
  );
}

