'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  locale: string;
  stationId: string;
  qrToken: string | null;
  qrVersion: string | null;
};

type ResolutionState = 'loading' | 'error';

/**
 * Displays the transient station QR resolver screen
 *
 * This client component is the visible bridge between a scanned QR code and
 * the backend resolver API that decides the final destination. It keeps the
 * UI lightweight, redirects immediately on success, and exposes a clean public
 * station fallback when resolution fails.
 *
 * @param {Props} props - Resolver page input derived from the route and query string
 * @param {string} props.locale - Active locale used for API calls and fallback URLs
 * @param {string} props.stationId - Station UUID being resolved
 * @param {string | null} props.qrToken - QR token extracted from the resolver URL
 * @param {string | null} props.qrVersion - QR version marker extracted from the resolver URL
 * @returns {JSX.Element} Loading state while resolving, or an error state with a fallback CTA
 * @throws {None} Network and parsing failures are handled by switching the component into its error state
 *
 * @example
 * <QrResolverPage
 *   locale="fr"
 *   stationId="station-123"
 *   qrToken="abc123"
 *   qrVersion="1"
 * />
 *
 * @example
 * <QrResolverPage
 *   locale="en"
 *   stationId="station-123"
 *   qrToken={null}
 *   qrVersion={null}
 * />
 *
 * @example
 * <QrResolverPage
 *   locale="fr"
 *   stationId="station-123"
 *   qrToken="abc123"
 *   qrVersion={null}
 * />
 */
export function QrResolverPage({ locale, stationId, qrToken, qrVersion }: Props) {
  const t = useTranslations('qr_resolver');
  const [state, setState] = useState<ResolutionState>('loading');

  const fallbackUrl = useMemo(() => {
    const query = new URLSearchParams();
    if (qrToken && qrVersion) {
      query.set('qr_token', qrToken);
      query.set('v', qrVersion);
    }
    const suffix = query.toString();
    return `/${locale}/stations/${stationId}${suffix ? `?${suffix}` : ''}`;
  }, [locale, qrToken, qrVersion, stationId]);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const query = new URLSearchParams({ locale });
        if (qrToken) query.set('qr_token', qrToken);
        if (qrVersion) query.set('v', qrVersion);
        const response = await fetch(`/api/v1/qr/stations/${encodeURIComponent(stationId)}/resolve?${query.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Resolver request failed');
        const body = await response.json() as { data?: { destination_url?: string } };
        const destinationUrl = body.data?.destination_url;
        if (!destinationUrl) throw new Error('Resolver response missing destination');
        if (cancelled) return;
        window.location.replace(destinationUrl);
      } catch {
        if (!cancelled) setState('error');
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [locale, qrToken, qrVersion, stationId]);

  if (state === 'error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[14px] font-semibold text-foreground/70">{t('error')}</p>
        <a
          href={fallbackUrl}
          className="rounded-xl border border-[#DDAF3B]/40 px-4 py-2 text-[13px] font-semibold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/10"
        >
          {t('fallback_cta')}
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-[#001201] dark:text-[#FFF9EC]">{t('title')}</p>
        <p className="text-[13px] text-foreground/60 dark:text-[#B0BFB1]">{t('subtitle')}</p>
      </div>
    </div>
  );
}
