import { setRequestLocale } from 'next-intl/server';
import { QrResolverPage } from '@/components/station/qr/QrResolverPage';

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ qr_token?: string; v?: string }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const resolvedSearchParams = await searchParams;
  setRequestLocale(locale);

  return (
    <QrResolverPage
      locale={locale}
      stationId={id}
      qrToken={resolvedSearchParams.qr_token ?? null}
      qrVersion={resolvedSearchParams.v ?? null}
    />
  );
}
