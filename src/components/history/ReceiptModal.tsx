'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, getAxiosInstance } from '@/services/axios-service';

interface HistoryReservation {
  id: string;
  stationName: string;
  stationAddress: string;
  vehicleFormatLabel: string | null;
  serviceName: string | null;
  serviceCategory: string | null;
  entryType: 'reservation' | 'queue';
  amountPaid: number;
  /** Tip portion of amountPaid, surfaced as a separate line. Optional. */
  tipAmount?: number | null;
  status: 'completed' | 'cancelled';
  createdAt: string;
}

/* Mirrors the labels used on station detail + /client/reservations so the
 * client sees consistent wording across screens. */
const RECEIPT_CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  hand_wash:      { fr: 'Lavage à la main',  en: 'Hand wash' },
  automatic_wash: { fr: 'Lavage automatique', en: 'Auto wash' },
  automatic:      { fr: 'Lavage automatique', en: 'Auto wash' },
  self_service:   { fr: 'Self-service',      en: 'Self-service' },
  exterior_wash:  { fr: 'Lavage extérieur',  en: 'Exterior wash' },
  detailing:      { fr: 'Détailing',         en: 'Detailing' },
};

function receiptCategoryLabel(category: string | null, locale: string): string | null {
  if (!category) return null;
  const entry = RECEIPT_CATEGORY_LABELS[category];
  if (!entry) return category;
  return locale === 'en' ? entry.en : entry.fr;
}

/**
 * Escapes HTML special characters to prevent XSS when interpolating
 * user-controlled strings into document.write() content.
 */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface ReceiptModalProps {
  entry: HistoryReservation;
  locale: string;
  onClose: () => void;
}

/**
 * Receipt modal for a reservation entry.
 * Completed entries show a "Download" button that fetches the receipt PDF
 * from the backend, or opens the Stripe receipt URL if available.
 */
export function ReceiptModal({ entry: e, locale, onClose }: ReceiptModalProps) {
  const t = useTranslations('history');
  const [downloading, setDownloading] = useState(false);
  const [stripeReceiptUrl, setStripeReceiptUrl] = useState<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Fetch receipt detail to check for Stripe receipt URL
  useEffect(() => {
    if (e.status !== 'completed') return;
    (async () => {
      const [ok, data] = await getFromApi(`/history/client/receipt/${e.id}`);
      if (!mountedRef.current) return;
      if (ok) {
        const receipt = (data as { data: { stripe_receipt_url?: string | null } }).data;
        if (receipt?.stripe_receipt_url) setStripeReceiptUrl(receipt.stripe_receipt_url);
      }
    })();
  }, [e.id, e.status]);

  const dateLabel = new Date(e.createdAt).toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  );

  /* Public reference: short and clean for screen + print. The full UUID is
   * still embedded in the downloaded PDF metadata, so support can always
   * trace a record from the prefix shown here. */
  const shortRef = e.id.slice(0, 8).toUpperCase();
  const typeLabel = e.entryType === 'queue' ? t('receipt_entry_type_queue') : t('receipt_entry_type_reservation');
  /* Service line favours the category (Lavage à la main / Auto / Self-service…),
   * falling back to the service name and finally a generic label for legacy
   * entries created before service_id was persisted on the row. */
  const serviceLabel =
    receiptCategoryLabel(e.serviceCategory, locale)
    ?? e.serviceName
    ?? t('receipt_service_generic');
  const vehicleLine = e.vehicleFormatLabel ?? t('receipt_service_unknown');

  const isCompleted = e.status === 'completed';

  /* Items breakdown: service line first (subtotal = total - tip) and an
   * optional tip line. Commission is internal accounting and never shown. */
  const tipAmount = Number(e.tipAmount ?? 0);
  const subtotal = Math.max(0, e.amountPaid - tipAmount);

  const handleDownload = async () => {
    // If Stripe receipt URL is available, open it directly
    if (stripeReceiptUrl) {
      window.open(stripeReceiptUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Otherwise, fetch PDF from backend
    setDownloading(true);
    try {
      const response = await getAxiosInstance().get(`/history/client/${e.id}/receipt.pdf`, {
        responseType: 'blob',
      });
      if (!mountedRef.current) return;
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${e.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open print dialog with HTML receipt
      handlePrintFallback();
    } finally {
      if (mountedRef.current) setDownloading(false);
    }
  };

  const handlePrintFallback = () => {
    const win = window.open('', '_blank', 'width=680,height=960');
    if (!win) return;

    // dateLabel is locale-formatted and does not contain user-controlled input, but escape for safety
    const safeDateLabel = escapeHtml(dateLabel);

    win.document.write(`<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <title>Hurryline - ${t('receipt_title')} ${escapeHtml(shortRef)}</title>
  <style>

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #f4f4f0;
      padding: 40px 20px;
      color: #111;
    }

    .page {
      max-width: 560px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
    }

    /* ── Header ── */
    .header {
      background: #0f1a0e;
      padding: 32px 36px 28px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .brand-name {
      font-size: 26px;
      font-weight: 900;
      color: #af8408;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 11px;
      color: #7a9a7d;
      margin-top: 4px;
      letter-spacing: .5px;
    }
    .receipt-badge {
      background: #af8408;
      color: #0f1a0e;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 5px 12px;
      border-radius: 20px;
      white-space: nowrap;
      margin-top: 4px;
    }

    /* ── Meta bar ── */
    .meta-bar {
      background: #f8f8f4;
      border-bottom: 1px solid #e8e8e0;
      padding: 16px 36px;
      display: flex;
      gap: 32px;
    }
    .meta-item .meta-label {
      font-size: 10px;
      font-weight: 700;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 3px;
    }
    .meta-item .meta-value {
      font-size: 13px;
      font-weight: 700;
      color: #111;
    }

    /* ── Body ── */
    .body { padding: 28px 36px; }

    .section-title {
      font-size: 10px;
      font-weight: 900;
      color: #af8408;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 10px;
      margin-top: 24px;
    }
    .section-title:first-child { margin-top: 0; }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border: 1px solid #e8e8e0;
      border-radius: 8px;
      overflow: hidden;
    }
    .info-cell {
      padding: 11px 14px;
      border-bottom: 1px solid #e8e8e0;
      border-right: 1px solid #e8e8e0;
    }
    .info-cell:nth-child(2n) { border-right: none; }
    .info-cell:nth-last-child(-n+2) { border-bottom: none; }
    .info-cell.full-width {
      grid-column: 1 / -1;
      border-right: none;
    }
    .cell-label {
      font-size: 10px;
      font-weight: 700;
      color: #999;
      text-transform: uppercase;
      letter-spacing: .8px;
      margin-bottom: 3px;
    }
    .cell-value {
      font-size: 13px;
      font-weight: 600;
      color: #111;
      word-break: break-word;
    }

    .extras-list {
      list-style: none;
      border: 1px solid #e8e8e0;
      border-radius: 8px;
      overflow: hidden;
    }
    .extras-list li {
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      color: #333;
      border-bottom: 1px solid #f0f0e8;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .extras-list li:last-child { border-bottom: none; }
    .extras-list li::before {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      background: #af8408;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ── Items table ── */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e8e8e0;
      border-radius: 8px;
      overflow: hidden;
    }
    .items-table td {
      padding: 12px 14px;
      vertical-align: middle;
      border-bottom: 1px solid #f0f0e8;
    }
    .items-table tr:last-child td { border-bottom: none; }
    .item-title {
      font-size: 13px;
      font-weight: 700;
      color: #111;
    }
    .item-title.item-secondary {
      font-size: 11px;
      font-weight: 600;
      color: #999;
      text-transform: uppercase;
      letter-spacing: .8px;
    }
    .item-sub {
      font-size: 11px;
      color: #888;
      margin-top: 2px;
    }
    .amount-cell {
      text-align: right;
      font-family: 'Roboto Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      color: #111;
      white-space: nowrap;
    }
    .amount-cell.amount-secondary {
      color: #555;
      font-weight: 600;
    }

    /* ── Total ── */
    .total-block {
      margin-top: 24px;
      background: #0f1a0e;
      border-radius: 10px;
      padding: 18px 22px;
    }
    .subtotal-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(122,154,125,0.25);
      margin-bottom: 10px;
    }
    .subtotal-label {
      font-size: 11px;
      font-weight: 700;
      color: #7a9a7d;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .subtotal-amount {
      font-family: 'Roboto Mono', monospace;
      font-size: 13px;
      color: #C0C0B0;
      font-weight: 600;
    }
    .total-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .total-label {
      font-size: 13px;
      font-weight: 700;
      color: #7a9a7d;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .total-amount {
      font-size: 28px;
      font-weight: 900;
      color: #af8408;
      letter-spacing: -0.5px;
    }

    /* ── Status chip ── */
    .status-chip {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
    }
    .status-completed { background: #e8f7ee; color: #1a7a40; }
    .status-cancelled { background: #fdecea; color: #c0392b; }

    /* ── Footer ── */
    .footer {
      margin-top: 0;
      border-top: 1px dashed #ddd;
      padding: 20px 36px;
      text-align: center;
    }
    .footer p {
      font-size: 12px;
      color: #aaa;
      line-height: 1.6;
    }
    .footer .thank-you {
      font-size: 13px;
      font-weight: 700;
      color: #555;
      margin-bottom: 4px;
    }

    @media print {
      @page { size: A4 portrait; margin: 10mm; }

      html, body {
        background: #fff !important;
        padding: 0 !important;
        margin: 0 !important;
        height: 100%;
      }

      .page {
        box-shadow: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
        page-break-inside: avoid;
      }

      .header { padding: 16px 24px 14px !important; }
      .brand-name { font-size: 20px !important; }
      .brand-sub { font-size: 9px !important; }
      .receipt-badge { font-size: 9px !important; padding: 4px 10px !important; }

      .meta-bar { padding: 10px 24px !important; gap: 20px !important; }
      .meta-item .meta-label { font-size: 8px !important; }
      .meta-item .meta-value { font-size: 11px !important; }

      .body { padding: 14px 24px !important; }

      .section-title { font-size: 8px !important; margin-top: 14px !important; margin-bottom: 6px !important; }
      .section-title:first-child { margin-top: 0 !important; }

      .info-cell { padding: 7px 10px !important; }
      .cell-label { font-size: 8px !important; margin-bottom: 2px !important; }
      .cell-value { font-size: 11px !important; }

      .extras-list li { padding: 6px 10px !important; font-size: 11px !important; }

      .total-block { margin-top: 14px !important; padding: 14px 18px !important; }
      .total-label { font-size: 11px !important; }
      .total-amount { font-size: 22px !important; }

      .footer { padding: 12px 24px !important; }
      .footer p { font-size: 10px !important; }
      .footer .thank-you { font-size: 11px !important; }
    }
  </style>
</head>
<body>
  <div class="page">

    <div class="header">
      <div>
        <div class="brand-name">Hurryline</div>
        <div class="brand-sub">Hurryline.app - Lavage auto simplifié</div>
      </div>
      <div class="receipt-badge">${t('receipt_title')}</div>
    </div>

    <div class="meta-bar">
      <div class="meta-item">
        <div class="meta-label">${t('receipt_ref')}</div>
        <div class="meta-value">#${escapeHtml(shortRef)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">${t('receipt_date')}</div>
        <div class="meta-value">${safeDateLabel}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">${t('receipt_entry_type')}</div>
        <div class="meta-value">${escapeHtml(typeLabel)}</div>
      </div>
    </div>

    <div class="body">

      <div class="section-title">${t('receipt_station')}</div>
      <div class="info-grid">
        <div class="info-cell full-width">
          <div class="cell-label">${t('receipt_station')}</div>
          <div class="cell-value">${escapeHtml(e.stationName)}</div>
        </div>
        <div class="info-cell full-width">
          <div class="cell-label">${t('receipt_address')}</div>
          <div class="cell-value">${escapeHtml(e.stationAddress)}</div>
        </div>
      </div>

      <div class="section-title">${t('receipt_items')}</div>
      <table class="items-table">
        <tbody>
          <tr>
            <td>
              <div class="item-title">${escapeHtml(serviceLabel)}</div>
              <div class="item-sub">${escapeHtml(vehicleLine)} &middot; ${escapeHtml(typeLabel)}</div>
            </td>
            <td class="amount-cell">$${subtotal.toFixed(2)}</td>
          </tr>
          ${tipAmount > 0 ? `<tr>
            <td><div class="item-title">${escapeHtml(t('receipt_tip'))}</div></td>
            <td class="amount-cell amount-secondary">$${tipAmount.toFixed(2)}</td>
          </tr>` : ''}
          <tr>
            <td><div class="item-title item-secondary">${t('receipt_status')}</div></td>
            <td class="amount-cell"><span class="status-chip status-${e.status}">${t(`status_${e.status}`)}</span></td>
          </tr>
        </tbody>
      </table>

      <div class="total-block">
        ${tipAmount > 0 ? `<div class="subtotal-line">
          <span class="subtotal-label">${t('receipt_subtotal_line')}</span>
          <span class="subtotal-amount">$${subtotal.toFixed(2)}</span>
        </div>` : ''}
        <div class="total-line">
          <span class="total-label">${t('receipt_total')}</span>
          <span class="total-amount">$${e.amountPaid.toFixed(2)}</span>
        </div>
      </div>

    </div>

    <div class="footer">
      <p class="thank-you">${t('receipt_footer')}</p>
      <p>Hurryline inc. &mdash; Hurryline.app</p>
    </div>

  </div>
</body>
</html>`);

    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/*
        On mobile the sheet slides up from the bottom.
        mb-14 offsets the BottomNav (sm:hidden, ~56px) so the action buttons
        are never hidden behind it.
      */}
      <div
        className="w-full sm:max-w-md bg-[#111713] dark:bg-[#111713] rounded-t-3xl sm:rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.55)] overflow-hidden animate-fade-in-up mb-14 sm:mb-0 border border-[#2a3128]"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3128]">
          <div>
            <h2 className="text-[17px] font-black text-[#F4EFE1]">{t('receipt_title')}</h2>
            <p className="text-[12px] text-[#8a927f] mt-0.5 font-semibold tracking-wide">
              Hurryline &mdash; #{shortRef}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('detail_close')}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#cfd3c5] hover:bg-[#1a211c] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Receipt preview - scrollable */}
        <div className="overflow-y-auto max-h-[55vh] sm:max-h-[60vh]">

          {/* Brand strip */}
          <div className="bg-gradient-to-r from-[#171e19] to-[#111713] px-5 py-4 flex items-center justify-between border-b border-[#2a3128]">
            <div>
              <div className="text-[18px] font-black text-[#E4C06A] tracking-widest uppercase">Hurryline</div>
              <div className="text-[11px] text-[#8a927f] mt-0.5">Hurryline.app</div>
            </div>
            <span className="text-[10px] font-black text-[#111713] bg-[#E4C06A] px-3 py-1 rounded-full tracking-wider uppercase">
              {t('receipt_title')}
            </span>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-3 border-b border-[#2a3128] bg-[#141b16]">
            {[
              { label: t('receipt_ref'),  value: `#${shortRef}` },
              { label: t('receipt_date'), value: new Date(e.createdAt).toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }) },
              { label: t('receipt_entry_type'), value: typeLabel },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-3 border-r border-[#2a3128] last:border-r-0">
                <div className="text-[10px] font-bold text-[#8a927f] uppercase tracking-wider mb-1">{label}</div>
                <div className="text-[12px] font-bold text-[#F4EFE1] truncate">{value}</div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Station */}
            <div>
              <p className="text-[10px] font-black text-[#E4C06A] uppercase tracking-widest mb-2">{t('receipt_station')}</p>
              <div className="rounded-xl border border-[#2a3128] overflow-hidden bg-[#141b16]">
                <ReceiptRow label={t('receipt_station')} value={e.stationName}  />
                <ReceiptRow label={t('receipt_address')} value={e.stationAddress} noBorder />
              </div>
            </div>

            {/* Items breakdown */}
            <div>
              <p className="text-[10px] font-black text-[#E4C06A] uppercase tracking-widest mb-2">{t('receipt_items')}</p>
              <div className="rounded-xl border border-[#2a3128] overflow-hidden bg-[#141b16]">
                {/* Service line */}
                <div className="flex items-start justify-between gap-4 px-3.5 py-3 border-b border-[#2a3128]">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#F4EFE1] truncate">{serviceLabel}</div>
                    <div className="text-[11px] text-[#9ea48f] mt-0.5">{vehicleLine} · {typeLabel}</div>
                  </div>
                  <span className="text-[13px] font-mono font-bold text-[#F4EFE1] whitespace-nowrap">${subtotal.toFixed(2)}</span>
                </div>
                {/* Tip line (only when present) */}
                {tipAmount > 0 && (
                  <div className="flex items-start justify-between gap-4 px-3.5 py-3 border-b border-[#2a3128]">
                    <div className="text-[13px] font-semibold text-[#c7cdb8]">{t('receipt_tip')}</div>
                    <span className="text-[13px] font-mono font-semibold text-[#c7cdb8] whitespace-nowrap">${tipAmount.toFixed(2)}</span>
                  </div>
                )}
                {/* Status row */}
                <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                  <span className="text-[11px] font-bold text-[#8a927f] uppercase tracking-wide">{t('receipt_status')}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${e.status === 'completed' ? 'bg-Hurryline-success/15 text-Hurryline-success' : 'bg-Hurryline-error/15 text-Hurryline-error'}`}>
                    {t(`status_${e.status}`)}
                  </span>
                </div>
              </div>
            </div>

            {/* Subtotal + Total */}
            <div className="rounded-2xl bg-[#0c100d] border border-[#2a3128] px-4 py-3 space-y-2">
              {tipAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9ea48f] uppercase tracking-wider">{t('receipt_subtotal_line')}</span>
                  <span className="text-[13px] font-mono text-[#C0C0B0] whitespace-nowrap">${subtotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#9ea48f] uppercase tracking-widest">{t('receipt_total')}</span>
                <span className="text-[26px] font-black text-[#E4C06A] leading-none whitespace-nowrap">${e.amountPaid.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-[11px] text-[#8a927f] text-center pb-1">{t('receipt_footer')}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[#2a3128] flex gap-3 bg-[#111713]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-[14px] font-bold border border-[#3a4338] text-[#c7cdb8] hover:bg-[#1a211c] transition-colors cursor-pointer"
          >
            {t('detail_close')}
          </button>
          {isCompleted && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 py-3 bg-[#E4C06A] hover:bg-[#d8b35d] rounded-2xl text-[14px] font-black text-[#111713] transition-colors btn-shine flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {downloading ? (
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
              {downloading ? t('downloading_receipt') : t('download_receipt')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function ReceiptRow({ label, value, noBorder }: { label: string; value: string; noBorder?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 px-3.5 py-2.5 ${noBorder ? '' : 'border-b border-[#2a3128]'}`}>
      <span className="text-[11px] font-bold text-[#8a927f] uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className="text-[13px] font-bold text-[#F4EFE1] text-right">{value}</span>
    </div>
  );
}

function ReceiptRowGrid({
  label, value, borderRight, borderTop, chip,
}: {
  label: string;
  value: string;
  borderRight?: boolean;
  borderTop?: boolean;
  chip?: string;
}) {
  const chipClass = chip === 'completed'
    ? 'bg-Hurryline-success/15 text-Hurryline-success'
    : chip === 'cancelled'
    ? 'bg-Hurryline-error/15 text-Hurryline-error'
    : '';

  return (
    <div className={[
      'px-3.5 py-2.5',
      borderRight ? 'border-r border-[#E0E0D0] dark:border-border' : '',
      borderTop   ? 'border-t border-[#E0E0D0] dark:border-border' : '',
    ].join(' ')}>
      <div className="text-[10px] font-bold text-[#999] uppercase tracking-wide mb-1">{label}</div>
      {chip ? (
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${chipClass}`}>{value}</span>
      ) : (
        <div className="text-[13px] font-bold text-foreground">{value}</div>
      )}
    </div>
  );
}
