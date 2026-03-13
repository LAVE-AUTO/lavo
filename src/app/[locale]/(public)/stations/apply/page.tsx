import { setRequestLocale, getTranslations } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { washTypes } from '@/lib/db/schema';
import { StationApplyForm } from '@/components/stations/apply/StationApplyForm';

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
 * Station onboarding application page.
 * Fetches active wash types from DB (server component) and passes them
 * to the multi-step client form.
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
    <main className="min-h-screen bg-[#EDEDED] dark:bg-dark-bg transition-colors flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-[26px] sm:text-[30px] font-bold text-dark-bg dark:text-white mb-2">
            {t('heading')}
          </h1>
          <p className="text-[15px] text-[#555] dark:text-lavo-muted">
            {t('subheading')}
          </p>
        </div>

        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-md py-8 px-6 sm:px-8 animate-fade-in-up">
          <StationApplyForm washTypes={activeWashTypes} />
        </div>
      </div>
    </main>
  );
}
