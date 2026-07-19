'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getFromApi } from '@/services';
import { useToast } from '@/context/toast-context';

interface PromotionInfo {
  active: boolean;
  ref_code?: string;
  referral_url?: string;
  commission_rate_percent?: number | null;
  expires_at?: string | null;
}

/**
 * Banner shown to the merchant on the dashboard and QR page when an admin-created
 * promotion is currently running for their station. Highlights the reduced
 * commission, the lifetime attribution of referred clients, and offers a one-tap
 * share of the promo referral link (Web Share API with a clipboard-copy fallback).
 * Renders nothing while loading or when no promotion is active.
 */
export function StationPromoBanner() {
  const t = useTranslations('station_promo_banner');
  const locale = useLocale();
  const { success, error } = useToast();
  const mountedRef = useRef(true);
  const [promo, setPromo] = useState<PromotionInfo | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadPromotion = useCallback(async () => {
    const [ok, data] = await getFromApi<PromotionInfo>('/station/promotion');
    if (!mountedRef.current) return;
    if (ok) setPromo((data as { data?: PromotionInfo })?.data ?? null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPromotion();
  }, [loadPromotion]);

  if (!promo?.active || !promo.referral_url) return null;

  const referralUrl = promo.referral_url;

  /* End date shown as a compact pill (e.g. "Jusqu'au 31 juil. 2026"). Hidden when
   * the promotion has no explicit expiry. */
  const untilLabel = (() => {
    if (!promo.expires_at) return null;
    const d = new Date(promo.expires_at);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  const bold = (chunks: React.ReactNode) => <strong className="font-black text-foreground">{chunks}</strong>;

  const handleShare = async () => {
    const shareData = { title: t('share_title'), text: t('share_text'), url: referralUrl };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* User dismissed the share sheet or it failed; fall through to copy. */
      }
    }
    try {
      await navigator.clipboard.writeText(referralUrl);
      success(t('copied'));
    } catch {
      error(t('copy_error'));
    }
  };

  return (
    <div className="mx-4 my-3 flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-4 sm:mx-6 dark:bg-gold/5">
      {/* Header: icon + title + optional end-date pill */}
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        </span>
        <p className="text-[14px] font-black text-foreground">{t('title')}</p>
        {untilLabel && (
          <span className="ml-auto shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[11px] font-bold text-gold">
            {t('badge_until', { date: untilLabel })}
          </span>
        )}
      </div>

      {/* Body message (bold reduced rate when available) */}
      <p className="text-[12.5px] leading-relaxed text-foreground/75 dark:text-[#B0BFB1]">
        {promo.commission_rate_percent != null
          ? t.rich('message_with_rate', { rate: promo.commission_rate_percent, b: bold })
          : t('message')}
      </p>

      {/* Lifetime attribution note */}
      <div className="flex items-start gap-2 rounded-xl bg-gold/10 px-3 py-2.5 dark:bg-gold/5">
        <svg className="mt-0.5 shrink-0 text-gold" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p className="text-[12px] leading-relaxed text-foreground/75 dark:text-[#B0BFB1]">
          {t.rich('lifetime_note', { b: bold })}
        </p>
      </div>

      {/* Full-width share action */}
      <button
        type="button"
        onClick={handleShare}
        className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-[13px] font-bold text-dark-bg transition-colors hover:bg-gold-hover"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {t('share_cta')}
      </button>
    </div>
  );
}
