import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { BottomNav } from '@/components/layout/BottomNav';
import { HeroSection } from '@/components/home/HeroSection';
import { MarqueeBanner } from '@/components/home/MarqueeBanner';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { HowItWorksSection } from '@/components/home/HowItWorksSection';
import { StationsPreviewSection } from '@/components/home/StationsPreviewSection';
import { NotificationsSection } from '@/components/home/NotificationsSection';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { FaqSection } from '@/components/home/FaqSection';
import { CtaSection } from '@/components/home/CtaSection';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
  };
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <PublicNavbar />
      <main className="min-h-screen bg-[#EDEDED] dark:bg-[#0d1f0f] transition-colors">
        <HeroSection />
        <MarqueeBanner />
        <FeaturesSection />
        <HowItWorksSection />
        <StationsPreviewSection />
        <NotificationsSection />
        <TestimonialsSection />
        <FaqSection />
        <CtaSection />
      </main>
      <div className="hidden sm:block">
        <PublicFooter />
      </div>
      <BottomNav />
    </>
  );
}
