import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { QrResolverPage } from '@/components/station/qr/QrResolverPage';

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ qr_token?: string; v?: string }>;
};

// Transient redirect target for scanned QR codes — must never be indexed.
export const metadata: Metadata = {
  title: 'Hurryline',
  robots: { index: false, follow: false },
};

/**
 * Renders the station QR resolver entry page
 *
 * This server component bridges the localized resolver route to the client-side
 * `QrResolverPage` component. It resolves the dynamic route params and query
 * string, applies the Next Intl request locale, and forwards the QR context
 * needed for the client redirect flow.
 *
 * @param {Props} props - Async route params and search params provided by Next.js
 * @param {Promise<{ locale: string; id: string }>} props.params - Dynamic route params containing the locale and station id
 * @param {Promise<{ qr_token?: string; v?: string }>} props.searchParams - Query params containing the QR token and version
 * @returns {Promise<JSX.Element>} Server-rendered resolver page shell that hydrates into the client redirect flow
 * @throws {None} This component does not throw under normal runtime conditions
 *
 * @example
 * const page = await Page({
 *   params: Promise.resolve({ locale: 'fr', id: 'station-123' }),
 *   searchParams: Promise.resolve({ qr_token: 'abc123', v: '1' }),
 * });
 *
 * @example
 * const page = await Page({
 *   params: Promise.resolve({ locale: 'en', id: 'station-123' }),
 *   searchParams: Promise.resolve({}),
 * });
 *
 * @example
 * const page = await Page({
 *   params: Promise.resolve({ locale: 'fr', id: 'station-123' }),
 *   searchParams: Promise.resolve({ v: '1' }),
 * });
 */
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
