import { setRequestLocale, getTranslations } from 'next-intl/server';
import { safeJsonLd } from '@/lib/json-ld';

export const revalidate = 3600;
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { LandingAuthRedirect } from '@/components/home/LandingAuthRedirect';
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
import { getLegalContent } from '@/server/admin/legal-content-service';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://Hurryline.cm';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Hurryline',
  url: APP_URL,
  logo: `${APP_URL}/icons/icon-192x192.png`,
  description:
    'Hurryline is the booking and payment platform for car wash stations in Canada. Find a station, book a slot, and get your car washed effortlessly.',
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

  const safeLocale: 'fr' | 'en' = locale === 'en' ? 'en' : 'fr';
  const [steps, faq, howHtml, faqHtml] = await Promise.all([
    getTranslations({ locale, namespace: 'home.steps' }),
    getTranslations({ locale, namespace: 'home.faq' }),
    getLegalContent('landing_how_it_works', { withDefault: true, locale: safeLocale }),
    getLegalContent('landing_faq',          { withDefault: true, locale: safeLocale }),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd) }}
      />
      <LandingAuthRedirect />
      <PublicNavbar />
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#FFF9EC] dark:bg-dark-bg transition-colors">
        <HeroSection />
        <MarqueeBanner />
        <FeaturesSection />
        <HowItWorksSection
          tag={steps('tag')}
          title={steps('title')}
          titleAccent={steps('title_accent')}
          html={howHtml ?? ''}
        />
        <StationsPreviewSection />
        <NotificationsSection />
        <TestimonialsSection />
        <FaqSection
          tag={faq('tag')}
          title={faq('title')}
          titleAccent={faq('title_accent')}
          html={faqHtml ?? ''}
        />
      </main>
      <div className="hidden sm:block">
        <PublicFooter />
      </div>
      <BottomNav />
    </>
  );
}
