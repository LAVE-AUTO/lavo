'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/context';
import { renderQrWithLogo, renderBrandedQrPosterToDataUrl } from '@/components/station/qr/qr-with-logo';

interface Props {
  stationId:   string;
  stationName: string;
  initialPromoCommissionRate?: string | null;
  initialPromoRefCode?: string | null;
}

const QR_SIZE = 200;

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').slice(0, 40) || 'station';
}

function promoRateToInput(rate: string | null | undefined): string {
  if (!rate) return '';
  const parsed = parseFloat(rate);
  return Number.isFinite(parsed) ? String(Number((parsed * 100).toFixed(1))) : '';
}

function buildPromoUrl(refCode: string, locale: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/${locale}/register?ref_code=${encodeURIComponent(refCode)}&source=promo`;
}

interface PromoQrResponse {
  station_id: string;
  promo_commission_rate: string | null;
  promo_commission_rate_percent: number | null;
  promo_ref_code: string | null;
  promo_ref_generated_at: string | null;
  referral_url: string | null;
}

export function AdminPromoQr({
  stationId,
  stationName,
  initialPromoCommissionRate,
  initialPromoRefCode,
}: Props) {
  const t      = useTranslations('admin_promo_qr');
  const locale = useLocale();
  const { token } = useAuth();

  const [commission, setCommission] = useState(promoRateToInput(initialPromoCommissionRate));
  const [commissionError, setCommissionError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [promoUrl, setPromoUrl] = useState<string | null>(null);
  const [appliedRate, setAppliedRate] = useState<string | null>(promoRateToInput(initialPromoCommissionRate) || null);
  const [refCode, setRefCode] = useState<string | null>(initialPromoRefCode ?? null);
  const [qrReady, setQrReady] = useState(false);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!refCode) {
      setPromoUrl(null);
      return;
    }
    setPromoUrl(buildPromoUrl(refCode, locale));
  }, [locale, refCode]);

  useEffect(() => {
    if (!promoUrl || !canvasRef.current) return;
    setQrReady(false);
    renderQrWithLogo(canvasRef.current, promoUrl, QR_SIZE)
      .then(() => setQrReady(true))
      .catch(() => setQrReady(true));
  }, [promoUrl]);

  const validate = useCallback((): boolean => {
    if (!commission.trim()) { setCommissionError(t('error_commission_required')); return false; }
    const val = parseFloat(commission);
    if (isNaN(val) || val < 0 || val > 50) { setCommissionError(t('error_commission_invalid')); return false; }
    /* Enforce 0.5-step precision: val * 2 must be an integer (e.g. 5 → 10 ok, 5.5 → 11 ok, 5.3 → 10.6 fail). */
    if (!Number.isInteger(val * 2)) { setCommissionError(t('error_commission_step')); return false; }
    setCommissionError(null);
    return true;
  }, [commission, t]);

  const handleGenerate = useCallback(async () => {
    if (!validate()) return;
    setGenerating(true);
    try {
      if (!token) {
        setCommissionError(t('error_session_expired'));
        return;
      }

      const response = await fetch(`/api/v1/admin/stations/${encodeURIComponent(stationId)}/promo-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ commission_rate_percent: Number(commission) }),
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        setCommissionError(t('error_save_failed'));
        return;
      }

      const body = (await response.json()) as { data?: PromoQrResponse };
      const data = body.data;
      const nextRefCode = data?.promo_ref_code ?? null;
      setRefCode(nextRefCode);
      setAppliedRate(String(Number(commission).toFixed(1)));
      if (data?.referral_url) {
        setPromoUrl(data.referral_url);
      } else if (nextRefCode) {
        setPromoUrl(buildPromoUrl(nextRefCode, locale));
      }
      setCommissionError(null);
    } catch {
      if (mountedRef.current) {
        setCommissionError(t('error_save_failed'));
      }
    } finally {
      if (mountedRef.current) {
        setGenerating(false);
      }
    }
  }, [commission, locale, stationId, t, validate, token]);

  async function downloadPng() {
    if (!promoUrl) return;
    try {
      const dataUrl = await renderBrandedQrPosterToDataUrl(promoUrl, {
        stationName,
        caption: t('poster_caption_promo'),
        footerTag: appliedRate ? t('poster_footer_promo', { rate: appliedRate }) : undefined,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qr-promo-${sanitizeFilename(stationName)}.png`;
      a.click();
    } catch { /* silently ignore - user stays on the page */ }
  }

  async function printPdf() {
    if (!promoUrl) return;
    try {
      const { jsPDF } = await import('jspdf');
      const dataUrl = await renderBrandedQrPosterToDataUrl(promoUrl, {
        stationName,
        caption: t('poster_caption_promo'),
        footerTag: appliedRate ? t('poster_footer_promo', { rate: appliedRate }) : undefined,
      });
      // A4 portrait for crisp poster output (210x297 mm)
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const posterW = 150;          // 15 cm wide
      const posterH = posterW * (1500 / 1080);
      const x = (pageW - posterW) / 2;
      const y = 25;
      doc.addImage(dataUrl, 'PNG', x, y, posterW, posterH);
      doc.save(`qr-promo-${sanitizeFilename(stationName)}.pdf`);
    } catch { /* silently ignore - user stays on the page */ }
  }

  const inputBase = 'w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#001201] outline-none transition-all dark:text-[#FFF9EC] border-[#D8D4C8] focus:border-[#DDAF3B] focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.10)] dark:border-[#001A05] dark:focus:border-[#DDAF3B]';

  return (
    <div className="rounded-2xl border border-separator/25 bg-card-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:bg-[#001A05] dark:ring-white/6">

      <div className="mb-5 flex items-start gap-2 rounded-xl border border-[#DDAF3B]/20 bg-[#DDAF3B]/8 px-4 py-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-[13px] leading-snug text-[#725800] dark:text-[#E7C96A]">
          {refCode ? t('saved_notice') : t('preview_only_notice')}
        </p>
      </div>

      {/* Section header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#DDAF3B]">{t('section_title')}</p>
          <p className="mt-0.5 text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{t('section_subtitle')}</p>
        </div>
        {appliedRate && (
          <span className="rounded-full border border-[#DDAF3B]/30 bg-[#DDAF3B]/10 px-3 py-1 text-[11px] font-black text-[#DDAF3B]">
            {t('commission_active_badge', { rate: appliedRate })}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">

        {/* Left: config + notice */}
        <div className="flex flex-1 flex-col gap-4">

          {/* Commission input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="promo-commission" className="text-[13px] font-bold text-foreground/70 dark:text-[#B0BFB1]">
              {t('field_commission')}<span className="ml-0.5 text-[#DDAF3B]">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="promo-commission" type="number" min={0} max={50} step={0.5}
                value={commission}
                required aria-required="true"
                placeholder={t('field_commission_placeholder')}
                onChange={(e) => { setCommission(e.target.value); setCommissionError(null); }}
                className={`w-32 ${inputBase} ${commissionError ? 'border-red-400 focus:border-red-400' : ''}`}
              />
              <span className="text-[13px] font-bold text-foreground/55 dark:text-[#B0BFB1]">%</span>
            </div>
            <p className="text-[12px] text-[#999] dark:text-[#B0BFB1]">{t('field_commission_hint')}</p>
            {commissionError && <p className="text-[12px] font-semibold text-red-500">{commissionError}</p>}
          </div>

          {/* Generate button */}
          <button type="button" onClick={handleGenerate} disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#DDAF3B] px-4 py-2.5 text-[13px] font-bold text-[#001201] transition-colors hover:bg-[#B08A14] disabled:opacity-50 sm:w-auto">
            {generating ? (
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                <line x1="14" y1="14" x2="14" y2="20" /><line x1="14" y1="14" x2="20" y2="14" /><line x1="20" y1="17" x2="20" y2="20" /><line x1="17" y1="20" x2="20" y2="20" />
              </svg>
            )}
            {generating ? t('btn_generating') : promoUrl ? t('btn_regenerate') : t('btn_generate')}
          </button>

          {/* How it works notice */}
          <div className="flex gap-2.5 rounded-xl border border-[#DDAF3B]/15 bg-[#DDAF3B]/5 px-3.5 py-3">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="text-[12px] font-bold text-[#001201] dark:text-[#FFF9EC]">{t('qr_notice_title')}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-foreground/65 dark:text-[#B0BFB1]">{t('qr_notice_body')}</p>
            </div>
          </div>

          {refCode && (
            <div className="rounded-xl border border-[#FFF9EC] bg-[#F8F6F2] px-3.5 py-3 dark:border-dark-surface dark:bg-dark-bg">
              <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#BBBBAA]">{t('ref_code_label')}</p>
              <p className="break-all text-[11px] font-mono text-foreground/70 dark:text-[#B8B2A2]">{refCode}</p>
            </div>
          )}
        </div>

        {/* Right: QR display + actions */}
        {promoUrl && (
          <div className="flex flex-col items-center gap-3">
            <div className={`rounded-xl border border-separator/25 bg-card-surface p-3 dark:border-dark-surface ${qrReady ? '' : 'animate-pulse'}`}>
              <canvas ref={canvasRef} className="block" />
            </div>

            {/* Referral URL */}
            <div className="w-full max-w-60 rounded-lg border border-[#FFF9EC] bg-[#F8F6F2] px-3 py-2 dark:border-dark-surface dark:bg-dark-bg">
              <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#BBBBAA]">{t('referral_url_label')}</p>
              <p className="break-all text-[9px] text-foreground/55 dark:text-[#B0BFB1]">{promoUrl}</p>
            </div>

            {/* Download + Print */}
            <div className="flex w-full max-w-60 gap-2">
              <button type="button" onClick={downloadPng}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#DDAF3B] px-3 py-2 text-[12px] font-bold text-[#001201] hover:bg-[#B08A14]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {t('btn_download_png')}
              </button>
              <button type="button" onClick={printPdf}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D8D4C8] px-3 py-2 text-[12px] font-semibold text-foreground/70 hover:bg-[#F5F3EE] dark:border-dark-surface dark:text-[#B0BFB1] dark:hover:bg-[#1A2A14]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                </svg>
                {t('btn_print_pdf')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
