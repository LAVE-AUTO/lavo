import { setRequestLocale, getTranslations } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { washTypes } from '@/lib/db/schema';
import { StationApplyForm } from '@/components/stations/apply/StationApplyForm';
import { MerchantBrandPanel } from '@/components/stations/apply/MerchantBrandPanel';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'station_apply' });
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
  };
}

/**
 * Station onboarding application page — split-screen layout.
 * Left: animated merchant brand panel (desktop only).
 * Right: 3-step onboarding form.
 */
export default async function StationApplyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'station_apply' });

  const activeWashTypes = await db
    .select({ id: washTypes.id, code: washTypes.code, label: washTypes.label })
    .from(washTypes)
    .where(eq(washTypes.is_active, true))
    .orderBy(washTypes.sort_order);

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel — desktop only */}
      <aside className="hidden lg:block lg:w-[42%] xl:w-[45%] shrink-0 sticky top-0 h-screen">
        <MerchantBrandPanel />
      </aside>

      {/* Right form panel */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen auth-form-bg overflow-y-auto scroll-smooth px-6 py-10">
        <div className="w-full max-w-lg animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-[26px] sm:text-[30px] font-bold text-dark-bg dark:text-white mb-2">
              {t('heading')}
            </h1>
            <p className="text-[15px] text-[#555] dark:text-lavo-muted">
              {t('subheading')}
            </p>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-gold/10 py-8 px-6 sm:px-8 animate-fade-in-up">
            <StationApplyForm washTypes={activeWashTypes} />
          </div>

          <p className="text-center mt-6 text-[14px] text-[#666] dark:text-lavo-muted">
            {t('already_member')}{' '}
            <a
              href={`/${locale}/merchant/login`}
              className="text-gold font-semibold hover:underline"
            >
              {t('login_link')}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
