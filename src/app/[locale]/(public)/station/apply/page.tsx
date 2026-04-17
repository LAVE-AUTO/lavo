import { setRequestLocale, getTranslations } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { washTypes } from '@/lib/db/schema';
import { StationApplyShell } from '@/components/stations/apply/StationApplyShell';

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
 * Station onboarding application page — URL: /stations/apply.
 * Delegates rendering to StationApplyShell (client) to enable per-step brand panel animation.
 * Lives outside the (stations-shell) route group so it does not inherit the stations navbar layout.
 */
export default async function StationApplyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const activeWashTypes = await db
    .select({ id: washTypes.id, code: washTypes.code, label: washTypes.label })
    .from(washTypes)
    .where(eq(washTypes.is_active, true))
    .orderBy(washTypes.sort_order);

  return <StationApplyShell washTypes={activeWashTypes} />;
}
