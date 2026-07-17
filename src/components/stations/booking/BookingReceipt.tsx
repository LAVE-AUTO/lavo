'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { generateReceiptPdf } from '@/components/receipts/generate-receipt-pdf';
import { type FinancialSnapshot } from '@/types/financial';
import type {
  StationDetailData,
  StationServicePublic,
  StationServiceEntry,
  StationServiceExtra,
} from '@/types/station';

type ArrivalMode = 'queue_now' | 'queue_later' | 'book_slot';

interface BookingReceiptProps {
  station: StationDetailData;
  service: StationServicePublic | null;
  entry: StationServiceEntry | null;
  extras: StationServiceExtra[];
  arrivalMode: ArrivalMode;
  selectedDate: string | null;
  laterTime: string | null;
  selectedSlotTime: string | null;
  servicePrice: number;
  extrasTotal: number;
  surchargeAmount: number;
  grandTotal: number;
  /** Backend-computed breakdown. When present, its fiscal lines and client_total
   *  are printed; otherwise the receipt falls back to the local service subtotal. */
  snapshot: FinancialSnapshot | null;
  ticketCode: string;
  queuePosition: number | null;
}

/**
 * Printable receipt + ticket code panel shown after a successful payment.
 *
 * The ticket code is sourced from the booking endpoint response and falls
 * back to a client-side generator when the backend payload omits it (legacy
 * entries created before the backend started persisting ticket_code).
 *
 * The "Download" action opens a dedicated print document and calls native
 * browser print/save-to-PDF there. This guarantees a single-page receipt and
 * avoids the parent page layout leaking into print output.
 */
/** Imperative handle so the parent (success screen) can trigger the receipt download
 *  from a button placed outside this component (top-right of the modal). */
export interface BookingReceiptHandle {
  download: () => void;
}

export const BookingReceipt = forwardRef<BookingReceiptHandle, BookingReceiptProps>(function BookingReceipt({
  station,
  service,
  entry,
  extras,
  arrivalMode,
  selectedDate,
  laterTime,
  selectedSlotTime,
  servicePrice,
  extrasTotal,
  surchargeAmount,
  grandTotal,
  snapshot,
  ticketCode,
  queuePosition,
}: BookingReceiptProps, ref) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  /* Total shown on the receipt: the backend client_total when available (includes
   * platform fee + TPS + TVQ), otherwise the locally computed service subtotal. */
  const receiptTotal = snapshot?.clientTotal ?? grandTotal;
  const fiscalLines = snapshot
    ? [
        ...(snapshot.platformServiceFee != null && snapshot.platformServiceFee > 0
          ? [{ label: t('payment_line_platform_fee'), amount: snapshot.platformServiceFee }]
          : []),
        ...(snapshot.tpsAmount != null && snapshot.tpsAmount > 0 ? [{ label: t('payment_line_tps'), amount: snapshot.tpsAmount }] : []),
        ...(snapshot.tvqAmount != null && snapshot.tvqAmount > 0 ? [{ label: t('payment_line_tvq'), amount: snapshot.tvqAmount }] : []),
      ]
    : [];

  const escapeHtml = (s: string): string => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(ticketCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable - the code is still visible on screen.
    }
  };

  const arrivalLabel = (() => {
    if (arrivalMode === 'queue_now') return t('result_arrival_queue_now');
    if (arrivalMode === 'queue_later') {
      return laterTime ? t('result_arrival_queue_later', { time: laterTime }) : t('result_arrival_queue_later_no_time');
    }
    if (selectedDate && selectedSlotTime) {
      return t('result_arrival_book_slot', { date: selectedDate, time: selectedSlotTime });
    }
    return '';
  })();

  const serviceName = service?.name ?? '';
  const formatLabel = entry?.formatLabel ?? null;
  const issuedAt = new Date().toLocaleString('fr-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  /* Real file download via the shared branded PDF generator. The legacy
   * print-window path remains as a fallback if PDF generation fails. */
  const handleDownload = async () => {
    const pdfLines = [
      { label: serviceName, amount: `$${servicePrice.toFixed(2)}`, sub: formatLabel ?? undefined },
      ...extras.map((ex) => ({ label: `+ ${ex.name}`, amount: `$${ex.price.toFixed(2)}` })),
      ...(surchargeAmount > 0
        ? [{ label: t('receipt_reservation_surcharge'), amount: `$${surchargeAmount.toFixed(2)}`, secondary: true }]
        : []),
      ...fiscalLines.map((fl) => ({ label: fl.label, amount: `$${fl.amount.toFixed(2)}`, secondary: true })),
    ];
    try {
      await generateReceiptPdf({
        title: t('receipt_title'),
        reference: ticketCode ? `#${ticketCode}` : '',
        dateLabel: issuedAt,
        stationName: station.name,
        stationAddress: `${station.address}, ${station.city}`,
        lines: [
          { label: t('receipt_arrival'), amount: '', sub: arrivalLabel, secondary: true },
          ...pdfLines,
        ],
        totalLabel: t('receipt_total'),
        totalAmount: `$${receiptTotal.toFixed(2)}`,
        ticketLabel: t('receipt_ticket_label'),
        ticketCode,
        ticketHint: t('receipt_ticket_hint'),
        footer: t('receipt_footer'),
        fileName: `hurryline-receipt-${ticketCode || 'booking'}`,
        locale,
      });
    } catch {
      handlePrintFallback();
    }
  };

  const handlePrintFallback = () => {
    const win = window.open('', '_blank', 'width=920,height=1200');
    if (!win) return;

    const lines = [
      { label: serviceName, value: `$${servicePrice.toFixed(2)}`, sub: formatLabel ?? '' },
      ...extras.map((ex) => ({ label: `+ ${ex.name}`, value: `$${ex.price.toFixed(2)}`, sub: '' })),
      ...(surchargeAmount > 0
        ? [{ label: t('receipt_reservation_surcharge'), value: `$${surchargeAmount.toFixed(2)}`, sub: '' }]
        : []),
      ...fiscalLines.map((fl) => ({ label: fl.label, value: `$${fl.amount.toFixed(2)}`, sub: '' })),
    ];

    const subtotal = servicePrice + extrasTotal + surchargeAmount;

    win.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Hurryline - ${escapeHtml(t('receipt_title'))}</title>
  <style>
    *{box-sizing:border-box} html,body{margin:0;padding:0;background:#eef1ec;color:#0f1711}
    body{font-family:"Plus Jakarta Sans","DM Sans","Segoe UI",sans-serif;padding:28px}
    .page{max-width:760px;margin:0 auto;background:#fff;border:1px solid #dfe5d8;border-radius:14px;overflow:hidden}
    .top{padding:18px 22px;border-bottom:1px solid #e3e8dd;display:flex;justify-content:space-between;gap:12px}
    .brand{font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#2f3b31;font-size:12px}
    .title{margin-top:4px;font-weight:800;font-size:26px;line-height:1;color:#121912}
    .meta-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#6b7668;font-weight:700}
    .meta-value{font-family:"JetBrains Mono","Fira Code",monospace;font-size:12px;color:#2f3b31}
    .section{padding:18px 22px;border-bottom:1px solid #eef2ea}
    .label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#6b7668;font-weight:800;margin-bottom:6px}
    .value{font-size:15px;font-weight:700;color:#001201}
    .muted{font-size:13px;color:#5f6b5d}
    .items{border:1px solid #e1e7dd;border-radius:12px;overflow:hidden}
    .row{display:flex;justify-content:space-between;gap:18px;padding:10px 12px;border-bottom:1px solid #edf2eb}
    .row:last-child{border-bottom:none}
    .row-l{min-width:0}
    .row-t{font-size:13px;font-weight:700;color:#001201}
    .row-s{font-size:11px;color:#6b7668;margin-top:2px}
    .row-v{font-family:"JetBrains Mono","Fira Code",monospace;font-size:13px;font-weight:700;color:#1b261f;white-space:nowrap}
    .total{margin-top:14px;background:#f7faf4;border:1px solid #dfe6d9;border-radius:12px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center}
    .total-l{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7668;font-weight:800}
    .total-v{font-family:"JetBrains Mono","Fira Code",monospace;font-size:26px;font-weight:900;color:#80620d}
    .code{margin-top:14px;border:1px solid #e1e7dd;border-radius:12px;padding:12px 14px;background:#fafcf8}
    .code-badge{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#80620d;font-weight:900}
    .code-value{font-family:"JetBrains Mono","Fira Code",monospace;font-size:38px;font-weight:900;letter-spacing:.3em;color:#121912;margin:6px 0 10px}
    .code-note{font-size:12px;line-height:1.45;color:#5f6b5d}
    .foot{padding:14px 22px;text-align:center;color:#6b7668;font-size:11px}
    @page{size:A4 portrait;margin:12mm}
    @media print{body{background:#fff;padding:0}.page{border:none;border-radius:0}}
  </style>
</head>
<body>
  <article class="page">
    <header class="top">
      <div>
        <div class="brand">Hurryline</div>
        <div class="title">${escapeHtml(t('receipt_title'))}</div>
      </div>
      <div>
        <div class="meta-label">${escapeHtml(t('receipt_issued_at'))}</div>
        <div class="meta-value">${escapeHtml(issuedAt)}</div>
      </div>
    </header>
    <section class="section">
      <div class="label">${escapeHtml(t('receipt_station'))}</div>
      <div class="value">${escapeHtml(station.name)}</div>
      <div class="muted">${escapeHtml(`${station.address}, ${station.city}`)}</div>
    </section>
    <section class="section">
      <div class="label">${escapeHtml(t('receipt_arrival'))}</div>
      <div class="value">${escapeHtml(arrivalLabel)}</div>
      ${arrivalMode === 'queue_later' && queuePosition != null ? `<div class="muted">${escapeHtml(t('result_queue_position_label'))} #${queuePosition}</div>` : ''}
    </section>
    <section class="section">
      <div class="items">
        ${lines.map((ln) => `<div class="row"><div class="row-l"><div class="row-t">${escapeHtml(ln.label)}</div>${ln.sub ? `<div class="row-s">${escapeHtml(ln.sub)}</div>` : ''}</div><div class="row-v">${escapeHtml(ln.value)}</div></div>`).join('')}
      </div>
      <div class="total">
        <span class="total-l">${escapeHtml(t('receipt_total'))}</span>
        <span class="total-v">$${receiptTotal.toFixed(2)}</span>
      </div>
      ${subtotal !== receiptTotal ? `<div style="margin-top:8px;font-size:11px;color:#6b7668;text-align:right">${escapeHtml(t('receipt_subtotal'))}: $${subtotal.toFixed(2)}</div>` : ''}
      <div class="code">
        <div class="code-badge">${escapeHtml(t('receipt_ticket_label'))}</div>
        <div class="code-value">${escapeHtml(ticketCode)}</div>
        <div class="code-note">${escapeHtml(t('receipt_ticket_hint'))}</div>
      </div>
    </section>
    <footer class="foot">${escapeHtml(t('receipt_footer'))}</footer>
  </article>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  useImperativeHandle(ref, () => ({ download: handleDownload }));

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4">
      {/* Receipt panel */}
      <div
        className="Hurryline-receipt-print bg-[#131914] text-[#FFEECA] rounded-3xl border border-[#3a4437] shadow-[0_24px_90px_rgba(0,0,0,0.55)] overflow-hidden ring-1 ring-[#55604d]/35"
      >
        {/* Header band */}
        <div className="bg-gradient-to-r from-[#1b241d] to-[#141c16] px-5 py-4 flex items-center justify-between border-b border-[#323b30]">
          <div>
            <Image
              src={locale === 'en' ? '/logo/logo_anglais_2.png' : '/logo/logo22_2.png'}
              alt="Hurryline"
              width={110}
              height={28}
              className="h-6 w-auto"
            />
            <div className="mt-1 text-[18px] font-black text-[#FFEECA] leading-tight">
              {t('receipt_title')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#B0BFB1]">
              {t('receipt_issued_at')}
            </div>
            <div className="text-[12px] font-mono text-[#e7dec4]">{issuedAt}</div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Station */}
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-[#B0BFB1] mb-1">
              {t('receipt_station')}
            </div>
            <div className="text-[15px] font-bold text-[#FFEECA]">{station.name}</div>
            <div className="text-[13px] text-[#FFEECA]">{station.address}, {station.city}</div>
          </div>

          {/* Arrival */}
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-[#B0BFB1] mb-1">
              {t('receipt_arrival')}
            </div>
            <div className="text-[14px] font-semibold text-[#FFEECA]">{arrivalLabel}</div>
            {arrivalMode === 'queue_later' && queuePosition != null && (
              <div className="text-[13px] text-[#FFEECA] mt-0.5">
                {t('result_queue_position_label')} <span className="font-bold text-[#DDAF3B]">#{queuePosition}</span>
              </div>
            )}
          </div>

          {/* Service breakdown */}
          <div className="border-t border-dashed border-[#394236] pt-3 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold truncate text-[#FFEECA]">{serviceName}</div>
                {formatLabel && <div className="text-[12px] text-[#B0BFB1]">{formatLabel}</div>}
              </div>
              <div className="text-[14px] font-mono shrink-0 text-[#FFEECA]">${servicePrice.toLocaleString()}</div>
            </div>

            {extras.map((ex) => (
              <div key={ex.id} className="flex items-baseline justify-between gap-3 text-[13px] text-[#FFEECA]">
                <span className="truncate">+ {ex.name}</span>
                <span className="font-mono shrink-0">${ex.price.toLocaleString()}</span>
              </div>
            ))}

            {surchargeAmount > 0 && (
              <div className="flex items-baseline justify-between gap-3 text-[13px] text-[#FFEECA]">
                <span>{t('receipt_reservation_surcharge')}</span>
                <span className="font-mono shrink-0">${surchargeAmount.toLocaleString()}</span>
              </div>
            )}

            {/* Backend fiscal lines: platform service fee, TPS, TVQ (when available). */}
            {fiscalLines.map((fl) => (
              <div key={fl.label} className="flex items-baseline justify-between gap-3 text-[13px] text-[#FFEECA]">
                <span>{fl.label}</span>
                <span className="font-mono shrink-0">${fl.amount.toFixed(2)}</span>
              </div>
            ))}

            {extrasTotal > 0 || surchargeAmount > 0 ? (
              <div className="flex items-baseline justify-between gap-3 text-[12px] text-[#B0BFB1] pt-1">
                <span>{t('receipt_subtotal')}</span>
                <span className="font-mono">${(servicePrice + extrasTotal + surchargeAmount).toLocaleString()}</span>
              </div>
            ) : null}
          </div>

          {/* Total */}
          <div className="bg-[#1b241d] border border-[#394236] rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-[13px] font-black uppercase tracking-wider text-[#a7ad98]">
              {t('receipt_total')}
            </span>
            <span className="text-[20px] font-black text-[#DDAF3B]">${receiptTotal.toFixed(2)}</span>
          </div>

          {/* Ticket code - copy button lives inside the box, to the right of the code */}
          <div className="bg-[#0e130f] border border-[#384133] text-white rounded-2xl px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="text-[10px] font-black uppercase tracking-[2px] text-[#DDAF3B] mb-1.5">
              {t('receipt_ticket_label')}
            </div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-[34px] font-black font-mono tracking-[0.35em] text-white leading-none">
                {ticketCode}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label={copied ? t('receipt_code_copied') : t('receipt_copy_code')}
                title={copied ? t('receipt_code_copied') : t('receipt_copy_code')}
                className="Hurryline-receipt-actions inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#404a3d] text-[#DDAF3B] hover:bg-[#181f1a] transition-colors cursor-pointer"
              >
                {copied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-[12px] text-[#aeb59f] leading-relaxed">
              {t('receipt_ticket_hint')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#0d120f] border-t border-[#001A05] text-[11px] text-[#B0BFB1] text-center">
          {t('receipt_footer')}
        </div>
      </div>
    </div>
  );
});

/**
 * Generate a 6-character ticket code with digits + uppercase letters.
 * Avoids visually ambiguous characters (0/O, 1/I/L).
 *
 * Used only as a defensive fallback when the booking endpoint response
 * does not include a server-issued `ticket_code` (legacy entries).
 */
export function generateTicketCode(): string {
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : null;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(6);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < 6; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  } else {
    for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
