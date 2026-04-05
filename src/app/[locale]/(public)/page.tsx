import { setRequestLocale, getTranslations } from 'next-intl/server';
import { safeJsonLd } from '@/lib/json-ld';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { BottomNav } from '@/components/layout/BottomNav';
import { HomeRedirectGuard } from '@/components/home/HomeRedirectGuard';
import { HeroSection } from '@/components/home/HeroSection';
import { MarqueeBanner } from '@/components/home/MarqueeBanner';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { HowItWorksSection } from '@/components/home/HowItWorksSection';
import { StationsPreviewSection } from '@/components/home/StationsPreviewSection';
import { NotificationsSection } from '@/components/home/NotificationsSection';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { FaqSection } from '@/components/home/FaqSection';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lavo.cm';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LAVO',
  url: APP_URL,
  logo: `${APP_URL}/icons/icon-192x192.png`,
  description:
    'LAVO is the booking and payment platform for car wash stations in Cameroon. Find a station, book a slot, and get your car washed effortlessly.',
  sameAs: [],
};

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: {
      canonical: `${APP_URL}/${locale}`,
      languages: {
        fr: `${APP_URL}/fr`,
        en: `${APP_URL}/en`,
      },
    },
    openGraph: {
      type: 'website' as const,
      url: `${APP_URL}/${locale}`,
      title: t('meta_title'),
      description: t('meta_desc'),
    },
  };
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd) }}
      />
      <HomeRedirectGuard />
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
      </main>
      <div className="hidden sm:block">
        <PublicFooter />
      </div>
      <BottomNav />
    </>
  );
}
