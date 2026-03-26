'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import QRCode from 'qrcode';

interface Props {
  stationId:   string;
  stationName: string;
}

const QR_SIZE = 200;

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').slice(0, 40) || 'station';
}

export function AdminPromoQr({ stationId, stationName }: Props) {
  const t      = useTranslations('admin_promo_qr');
  const locale = useLocale();

  const [commission,      setCommission]      = useState('');
  const [commissionError, setCommissionError] = useState<string | null>(null);
  const [generating,      setGenerating]      = useState(false);
  const [promoUrl,        setPromoUrl]        = useState<string | null>(null);
  const [appliedRate,     setAppliedRate]     = useState<string | null>(null);
  const [qrReady,         setQrReady]         = useState(false);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!promoUrl || !canvasRef.current) return;
    setQrReady(false);
    QRCode.toCanvas(canvasRef.current, promoUrl, {
      width: QR_SIZE, margin: 2, errorCorrectionLevel: 'H',
      color: { dark: '#1A1A0A', light: '#FFFFFF' },
    }).then(() => setQrReady(true)).catch(() => setQrReady(true));
  }, [promoUrl]);

  function validate(): boolean {
    if (!commission.trim()) { setCommissionError(t('error_commission_required')); return false; }
    const val = parseFloat(commission);
    if (isNaN(val) || val < 0 || val > 50) { setCommissionError(t('error_commission_invalid')); return false; }
    /* Enforce 0.5-step precision: val * 2 must be an integer (e.g. 5 → 10 ok, 5.5 → 11 ok, 5.3 → 10.6 fail). */
    if (!Number.isInteger(val * 2)) { setCommissionError(t('error_commission_step')); return false; }
    setCommissionError(null);
    return true;
  }

  const handleGenerate = useCallback(async () => {
    if (!validate()) return;
    setGenerating(true);

    // TODO: connect to API once endpoint is available (POST /admin/stations/:id/promo-qr)
    // Payload: { commission_rate: parseFloat(commission) / 100 }
    // Backend must: store promo_commission_rate on station, generate unique ref_code (HMAC-based),
    //   return { ref_code, commission_rate }. Regenerating the QR invalidates the previous ref_code.
    //   On client's first reservation at this station: apply stored promo rate once per (client, station) pair.
    await new Promise<void>((r) => setTimeout(r, 700));

    if (!mountedRef.current) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setPromoUrl(`${origin}/${locale}/register?ref=${stationId}&source=promo`);
    setAppliedRate(commission);
    setGenerating(false);
  }, [commission, locale, stationId, t]);

  async function downloadPng() {
    if (!promoUrl) return;
    try {
      const dataUrl = await QRCode.toDataURL(promoUrl, {
        width: 1024, margin: 2, errorCorrectionLevel: 'H',
        color: { dark: '#1A1A0A', light: '#FFFFFF' },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qr-promo-${sanitizeFilename(stationName)}.png`;
      a.click();
    } catch { /* silently ignore — user stays on the page */ }
  }

  async function printPdf() {
    if (!promoUrl) return;
    try {
      const { jsPDF } = await import('jspdf');
      const dataUrl = await QRCode.toDataURL(promoUrl, {
        width: 1024, margin: 2, errorCorrectionLevel: 'H',
        color: { dark: '#1A1A0A', light: '#FFFFFF' },
      });
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 100] });
      doc.addImage(dataUrl, 'PNG', 10, 10, 80, 80);
      doc.save(`qr-promo-${sanitizeFilename(stationName)}.pdf`);
    } catch { /* silently ignore — user stays on the page */ }
  }

  const inputBase = 'w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#1A1A0A] outline-none transition-all dark:text-[#F0EDD4] border-[#D8D4C8] focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] dark:border-[#243020] dark:focus:border-[#C49A1E]';

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">

      {/* Preview-only warning — QR is not functional until the API endpoint is connected */}
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900/40 dark:bg-orange-950/20">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="text-[12px] leading-snug text-orange-700 dark:text-orange-400">{t('preview_only_notice')}</p>
      </div>

      {/* Section header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#C49A1E]">{t('section_title')}</p>
          <p className="mt-0.5 text-[11px] text-[#888] dark:text-[#6A6A5A]">{t('section_subtitle')}</p>
        </div>
        {appliedRate && (
          <span className="rounded-full border border-[#C49A1E]/30 bg-[#C49A1E]/10 px-3 py-1 text-[10px] font-black text-[#C49A1E]">
            {t('commission_active_badge', { rate: appliedRate })}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">

        {/* Left: config + notice */}
        <div className="flex flex-1 flex-col gap-4">

          {/* Commission input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="promo-commission" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">
              {t('field_commission')}<span className="ml-0.5 text-[#C49A1E]">*</span>
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
              <span className="text-[13px] font-bold text-[#888] dark:text-[#6A6A5A]">%</span>
            </div>
            <p className="text-[11px] text-[#999] dark:text-[#5A5A4A]">{t('field_commission_hint')}</p>
            {commissionError && <p className="text-[11px] font-semibold text-red-500">{commissionError}</p>}
          </div>

          {/* Generate button */}
          <button type="button" onClick={handleGenerate} disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C49A1E] px-4 py-2.5 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14] disabled:opacity-50 sm:w-auto">
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
          <div className="flex gap-2.5 rounded-xl border border-[#C49A1E]/15 bg-[#C49A1E]/5 px-3.5 py-3">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="text-[11px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('qr_notice_title')}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#666] dark:text-[#8A8A7A]">{t('qr_notice_body')}</p>
            </div>
          </div>
        </div>

        {/* Right: QR display + actions */}
        {promoUrl && (
          <div className="flex flex-col items-center gap-3">
            <div className={`rounded-xl border border-[#E8E4DC] bg-white p-3 dark:border-[#243020] ${qrReady ? '' : 'animate-pulse'}`}>
              <canvas ref={canvasRef} className="block" />
            </div>

            {/* Referral URL */}
            <div className="w-full max-w-[240px] rounded-lg border border-[#E8E4DC] bg-[#F8F6F2] px-3 py-2 dark:border-[#243020] dark:bg-[#0F1A0C]">
              <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#BBBBAA]">{t('referral_url_label')}</p>
              <p className="break-all text-[9px] text-[#888] dark:text-[#6A6A5A]">{promoUrl}</p>
            </div>

            {/* Download + Print */}
            <div className="flex w-full max-w-[240px] gap-2">
              <button type="button" onClick={downloadPng}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#C49A1E] px-3 py-2 text-[11px] font-bold text-[#0C1209] hover:bg-[#B08A14]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {t('btn_download_png')}
              </button>
              <button type="button" onClick={printPdf}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D8D4C8] px-3 py-2 text-[11px] font-semibold text-[#555] hover:bg-[#F5F3EE] dark:border-[#243020] dark:text-[#9A9A8A] dark:hover:bg-[#1A2A14]">
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
