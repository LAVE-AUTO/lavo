'use client';

import { useTranslations } from 'next-intl';
import type { MockReservation } from '@/data/reservations-mock';

interface ReceiptModalProps {
  entry: MockReservation;
  locale: string;
  onClose: () => void;
}

/**
 * Receipt modal for a completed reservation.
 * The "Download" button opens a standalone print window — no external dependencies.
 */
export function ReceiptModal({ entry: e, locale, onClose }: ReceiptModalProps) {
  const t = useTranslations('history');

  const dateLabel = new Date(e.date).toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  );

  const isCompleted = e.status === 'completed';

  const handlePrint = () => {
    const extrasRow = e.extras.length > 0
      ? `<div class="row"><span class="lbl">${t('receipt_extras')}</span><span class="val">${e.extras.join(', ')}</span></div>`
      : '';

    const win = window.open('', '_blank', 'width=640,height=900');
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>LAVO — ${e.id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;padding:48px 40px;color:#0A0A14;background:#fff;max-width:560px;margin:0 auto}
    .logo{font-size:30px;font-weight:900;color:#af8408;letter-spacing:4px}
    .logo-sub{font-size:11px;color:#999;margin-top:4px;margin-bottom:28px}
    .sep{border:none;border-top:2px solid #af8408;margin:0 0 20px}
    .title{font-size:17px;font-weight:700;margin-bottom:16px}
    .row{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid #eee;gap:16px}
    .lbl{font-size:13px;color:#666;font-weight:600;white-space:nowrap}
    .val{font-size:13px;font-weight:700;text-align:right;word-break:break-word;max-width:60%}
    .total{display:flex;justify-content:space-between;align-items:center;padding:14px 0 0;border-top:2px solid #af8408;margin-top:8px}
    .total-lbl{font-size:17px;font-weight:900}
    .total-val{font-size:20px;font-weight:900;color:#af8408}
    .footer{margin-top:36px;font-size:11px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:16px}
  </style>
</head>
<body>
  <div class="logo">LAVO</div>
  <div class="logo-sub">lavo.app</div>
  <hr class="sep">
  <div class="title">${t('receipt_title')}</div>
  <div class="row"><span class="lbl">${t('receipt_ref')}</span><span class="val">#${e.id.toUpperCase()}</span></div>
  <div class="row"><span class="lbl">${t('receipt_station')}</span><span class="val">${e.stationName}</span></div>
  <div class="row"><span class="lbl">${t('receipt_address')}</span><span class="val">${e.stationAddress}</span></div>
  <div class="row"><span class="lbl">${t('receipt_date')}</span><span class="val">${dateLabel}</span></div>
  <div class="row"><span class="lbl">${t('receipt_time')}</span><span class="val">${e.timeSlot}</span></div>
  <div class="row"><span class="lbl">${t('receipt_forfait')}</span><span class="val">${e.forfaitName}</span></div>
  <div class="row"><span class="lbl">${t('receipt_category')}</span><span class="val">${e.categoryLabel}</span></div>
  ${extrasRow}
  <div class="row"><span class="lbl">${t('receipt_duration')}</span><span class="val">${e.duration} min</span></div>
  <div class="row"><span class="lbl">${t('receipt_status')}</span><span class="val">${t(`status_${e.status}`)}</span></div>
  <div class="total">
    <span class="total-lbl">${t('receipt_total')}</span>
    <span class="total-val">${e.totalPrice}$</span>
  </div>
  <div class="footer">${t('receipt_footer')}</div>
</body>
</html>`);

    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#F5F5E6] dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D0D0C0] dark:border-tab-inactive">
          <h2 className="text-[17px] font-black text-[#0A0A14] dark:text-white">{t('receipt_title')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('detail_close')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#E0E0D0] dark:hover:bg-tab-inactive transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Receipt preview */}
        <div className="overflow-y-auto max-h-[65vh] px-5 py-4 space-y-0">
          {/* Logo row */}
          <div className="mb-4">
            <div className="text-[22px] font-black text-gold tracking-widest">LAVO</div>
          </div>

          <div className="border-t-2 border-gold mb-4" />

          <div className="space-y-0">
            <ReceiptRow label={t('receipt_ref')}      value={`#${e.id.toUpperCase()}`} />
            <ReceiptRow label={t('receipt_station')}  value={e.stationName} />
            <ReceiptRow label={t('receipt_address')}  value={e.stationAddress} />
            <ReceiptRow label={t('receipt_date')}     value={dateLabel} />
            <ReceiptRow label={t('receipt_time')}     value={e.timeSlot} />
            <ReceiptRow label={t('receipt_forfait')}  value={e.forfaitName} />
            <ReceiptRow label={t('receipt_category')} value={e.categoryLabel} />
            {e.extras.length > 0 && (
              <ReceiptRow label={t('receipt_extras')} value={e.extras.join(', ')} />
            )}
            <ReceiptRow label={t('receipt_duration')} value={`${e.duration} min`} />
            <ReceiptRow label={t('receipt_status')}   value={t(`status_${e.status}`)} />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-3 border-t-2 border-gold mt-2">
            <span className="text-[16px] font-black text-[#0A0A14] dark:text-white">{t('receipt_total')}</span>
            <span className="text-[20px] font-black text-gold">{e.totalPrice}$</span>
          </div>

          <p className="text-[11px] text-[#AAA] text-center mt-5 pb-1">{t('receipt_footer')}</p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[#D0D0C0] dark:border-tab-inactive flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-[14px] font-bold border-2 border-[#D0D0C0] dark:border-tab-inactive text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-tab-inactive transition-colors cursor-pointer"
          >
            {t('detail_close')}
          </button>
          {isCompleted && (
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors btn-shine flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('download_receipt')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[#E0E0D0] dark:border-tab-inactive">
      <span className="text-[13px] text-[#666] dark:text-[#999] font-semibold whitespace-nowrap">{label}</span>
      <span className="text-[13px] font-bold text-[#0A0A14] dark:text-white text-right break-words max-w-[55%]">{value}</span>
    </div>
  );
}
