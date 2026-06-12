'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context';
import { renderQrWithLogo, renderBrandedQrPosterToDataUrl } from '@/components/station/qr/qr-with-logo';

interface Props {
  stationId: string;
  stationName: string;
}

interface PromoQrResponse {
  station_id: string;
  promo_commission_rate: string | null;
  promo_commission_rate_percent: number | null;
  promo_ref_code: string | null;
  promo_ref_generated_at: string | null;
  promo_expires_at: string | null;
  promo_is_active: boolean;
  qr_url: string;
  referral_url: string | null;
}

const QR_SIZE = 200;
const POSTER_WIDTH_MM = 150;
const POSTER_ASPECT_RATIO = 1500 / 1080;

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').slice(0, 40) || 'station';
}

function isoToDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateInputToEndOfDayIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function todayInputValue(): string {
  return isoToDateInput(new Date().toISOString());
}

function buildPromoPosterOptions(
  stationName: string,
  caption: string,
  footerTag?: string,
) {
  return {
    stationName,
    caption,
    footerTag,
  };
}

export function AdminPromoQr({ stationId, stationName }: Props) {
  const t = useTranslations('admin_promo_qr');
  const { token } = useAuth();

  const [commission, setCommission] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [promoUrl, setPromoUrl] = useState<string | null>(null);
  const [appliedRate, setAppliedRate] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [qrReady, setQrReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyResponse = useCallback((data: PromoQrResponse | null | undefined) => {
    if (!data) return;
    setPromoUrl(data.qr_url);
    setAppliedRate(
      typeof data.promo_commission_rate_percent === 'number'
        ? data.promo_commission_rate_percent.toFixed(1)
        : null,
    );
    setRefCode(data.promo_ref_code ?? null);
    setExpiresAt(data.promo_expires_at ?? null);
    setIsActive(Boolean(data.promo_is_active));
    setCommission(
      typeof data.promo_commission_rate_percent === 'number'
        ? data.promo_commission_rate_percent.toFixed(1)
        : '',
    );
    setExpiryDate(isoToDateInput(data.promo_expires_at));
  }, []);

  const posterOptions = appliedRate
    ? buildPromoPosterOptions(
        stationName,
        t('poster_caption_promo'),
        t('poster_footer_promo', { rate: appliedRate }),
      )
    : buildPromoPosterOptions(stationName, t('poster_caption_promo'));

  const loadConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/stations/${encodeURIComponent(stationId)}/promo-qr`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        setFieldError(t('error_load_failed'));
        return;
      }

      const body = (await response.json()) as { data?: PromoQrResponse };
      applyResponse(body.data);
      setFieldError(null);
    } catch {
      if (mountedRef.current) {
        setFieldError(t('error_load_failed'));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [applyResponse, stationId, t, token]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!promoUrl || !canvasRef.current) return;
    setQrReady(false);
    renderQrWithLogo(canvasRef.current, promoUrl, QR_SIZE)
      .then(() => setQrReady(true))
      .catch(() => setQrReady(true));
  }, [promoUrl]);

  const validate = useCallback((): string | null => {
    if (!commission.trim()) return t('error_commission_required');
    const val = parseFloat(commission);
    if (Number.isNaN(val) || val < 0 || val > 100) return t('error_commission_invalid');
    if (!Number.isInteger(val * 2)) return t('error_commission_step');
    if (!expiryDate) return t('error_expiry_required');
    const expiresAtIso = dateInputToEndOfDayIso(expiryDate);
    if (!expiresAtIso) return t('error_expiry_invalid');
    if (new Date(expiresAtIso).getTime() <= Date.now()) return t('error_expiry_future');
    return null;
  }, [commission, expiryDate, t]);

  const handleGenerate = useCallback(async () => {
    const nextError = validate();
    if (nextError) {
      setFieldError(nextError);
      return;
    }

    setGenerating(true);
    try {
      if (!token) {
        setFieldError(t('error_session_expired'));
        return;
      }

      const expiresAtIso = dateInputToEndOfDayIso(expiryDate);
      if (!expiresAtIso) {
        setFieldError(t('error_expiry_invalid'));
        return;
      }

      const response = await fetch(`/api/v1/admin/stations/${encodeURIComponent(stationId)}/promo-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          commission_rate_percent: Number(commission),
          expires_at: expiresAtIso,
        }),
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        setFieldError(t('error_save_failed'));
        return;
      }

      const body = (await response.json()) as { data?: PromoQrResponse };
      applyResponse(body.data);
      setFieldError(null);
    } catch {
      if (mountedRef.current) {
        setFieldError(t('error_save_failed'));
      }
    } finally {
      if (mountedRef.current) {
        setGenerating(false);
      }
    }
  }, [applyResponse, commission, expiryDate, stationId, t, token, validate]);

  async function downloadPng() {
    if (!promoUrl) return;
    try {
      const dataUrl = await renderBrandedQrPosterToDataUrl(promoUrl, posterOptions);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qr-promo-${sanitizeFilename(stationName)}.png`;
      a.click();
    } catch {
      // Ignore poster export failure and keep the user on the page.
    }
  }

  async function printPdf() {
    if (!promoUrl) return;
    try {
      const { jsPDF } = await import('jspdf');
      const dataUrl = await renderBrandedQrPosterToDataUrl(promoUrl, posterOptions);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const posterHeightMm = POSTER_WIDTH_MM * POSTER_ASPECT_RATIO;
      const x = (pageW - POSTER_WIDTH_MM) / 2;
      const y = 25;
      doc.addImage(dataUrl, 'PNG', x, y, POSTER_WIDTH_MM, posterHeightMm);
      doc.save(`qr-promo-${sanitizeFilename(stationName)}.pdf`);
    } catch {
      // Ignore poster export failure and keep the user on the page.
    }
  }

  const inputBase = 'w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#001201] outline-none transition-all dark:text-[#FFF9EC] border-[#D8D4C8] focus:border-[#DDAF3B] focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.10)] dark:border-[#001A05] dark:focus:border-[#DDAF3B]';
  const hasFieldError = fieldError != null;

  return (
    <div className="rounded-2xl border border-separator/25 bg-card-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:bg-[#001A05] dark:ring-white/6">
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-[#DDAF3B]/20 bg-[#DDAF3B]/8 px-4 py-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-[13px] leading-snug text-[#725800] dark:text-[#E7C96A]">
          {isActive ? t('saved_notice') : t('preview_only_notice')}
        </p>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#DDAF3B]">{t('section_title')}</p>
          <p className="mt-0.5 text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{t('section_subtitle')}</p>
        </div>
        {appliedRate && isActive && (
          <span className="rounded-full border border-[#DDAF3B]/30 bg-[#DDAF3B]/10 px-3 py-1 text-[11px] font-black text-[#DDAF3B]">
            {t('commission_active_badge', { rate: appliedRate })}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
        <div className="flex flex-1 flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="promo-commission" className="text-[13px] font-bold text-foreground/70 dark:text-[#B0BFB1]">
                {t('field_commission')}<span className="ml-0.5 text-[#DDAF3B]">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="promo-commission"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={commission}
                  required
                  aria-required="true"
                  placeholder={t('field_commission_placeholder')}
                  onChange={(e) => { setCommission(e.target.value); setFieldError(null); }}
                  className={`w-32 ${inputBase} ${hasFieldError ? 'border-red-400 focus:border-red-400' : ''}`}
                />
                <span className="text-[13px] font-bold text-foreground/55 dark:text-[#B0BFB1]">%</span>
              </div>
              <p className="text-[12px] text-[#999] dark:text-[#B0BFB1]">{t('field_commission_hint')}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="promo-expiry" className="text-[13px] font-bold text-foreground/70 dark:text-[#B0BFB1]">
                {t('field_expiry')}<span className="ml-0.5 text-[#DDAF3B]">*</span>
              </label>
              <input
                id="promo-expiry"
                type="date"
                min={todayInputValue()}
                value={expiryDate}
                onChange={(e) => { setExpiryDate(e.target.value); setFieldError(null); }}
                className={`${inputBase} ${hasFieldError ? 'border-red-400 focus:border-red-400' : ''}`}
              />
              <p className="text-[12px] text-[#999] dark:text-[#B0BFB1]">{t('field_expiry_hint')}</p>
            </div>
          </div>

          {fieldError && <p className="text-[12px] font-semibold text-red-500">{fieldError}</p>}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#DDAF3B] px-4 py-2.5 text-[13px] font-bold text-[#001201] transition-colors hover:bg-[#B08A14] disabled:opacity-50 sm:w-auto"
          >
            {generating ? (
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                <line x1="14" y1="14" x2="14" y2="20" /><line x1="14" y1="14" x2="20" y2="14" /><line x1="20" y1="17" x2="20" y2="20" /><line x1="17" y1="20" x2="20" y2="20" />
              </svg>
            )}
            {generating ? t('btn_generating') : isActive ? t('btn_regenerate') : t('btn_generate')}
          </button>

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
              {expiresAt && (
                <p className="mt-2 text-[11px] text-foreground/55 dark:text-[#B0BFB1]">
                  {t('expiry_summary', { date: isoToDateInput(expiresAt) })}
                </p>
              )}
            </div>
          )}
        </div>

        {promoUrl && (
          <div className="flex flex-col items-center gap-3">
            <div className={`rounded-xl border border-separator/25 bg-card-surface p-3 dark:border-dark-surface ${qrReady ? '' : 'animate-pulse'}`}>
              <canvas ref={canvasRef} width={QR_SIZE} height={QR_SIZE} className="h-[200px] w-[200px]" />
            </div>

            <div className="max-w-[220px] rounded-xl border border-[#FFF9EC] bg-[#F8F6F2] px-3 py-2 text-center dark:border-dark-surface dark:bg-dark-bg">
              <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#BBBBAA]">{t('qr_url_label')}</p>
              <p className="break-all text-[9px] text-foreground/55 dark:text-[#B0BFB1]">{promoUrl}</p>
            </div>

            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={downloadPng}
                disabled={loading}
                className="flex-1 rounded-xl border border-[#DDAF3B]/20 bg-[#DDAF3B]/8 px-3 py-2 text-[12px] font-bold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/16"
              >
                {t('btn_download_png')}
              </button>
              <button
                type="button"
                onClick={printPdf}
                disabled={loading}
                className="flex-1 rounded-xl border border-separator/30 bg-[#FFF9EC] px-3 py-2 text-[12px] font-bold text-foreground/65 transition-colors hover:bg-[#F8F3E1] dark:border-dark-surface dark:bg-dark-bg dark:text-[#B0BFB1] dark:hover:bg-[#10200E]"
              >
                {t('btn_download_pdf')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
