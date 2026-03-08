import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MerchantComingSoon } from '@/components/landing/MerchantComingSoon';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'merchant' });
  return { title: t('meta_title') };
}

export default async function MerchantPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <PublicNavbar />
      <MerchantComingSoon />
      <PublicFooter />
    </>
  );
}
