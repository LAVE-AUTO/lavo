'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  ticketCode: string;
  queuePosition: number | null;
}

/**
 * Printable receipt + ticket code panel shown after a successful payment.
 *
 * The 6-char ticket code is generated client-side for now; the station-side
 * validation requires a backend endpoint that doesn't exist yet (TODO: wire
 * `POST /station/entries/:id/start { code }` once the backend ships it).
 *
 * The "Download" action triggers `window.print()` scoped to the receipt block
 * via the `lavo-receipt-print` class and the dedicated @media print rules in
 * globals.css. Works without external libraries (no jsPDF/html2canvas).
 */
export function BookingReceipt({
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
  ticketCode,
  queuePosition,
}: BookingReceiptProps) {
  const t = useTranslations('booking');
  const printRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    /* Use the browser's native Print → Save as PDF flow. The CSS in
     * globals.css ensures only the receipt block is printed. */
    window.print();
  };

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

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4">
      {/* Receipt panel */}
      <div
        ref={printRef}
        className="lavo-receipt-print bg-white dark:bg-[#FFFEF8] text-[#0A0A14] rounded-2xl border-2 border-gold/30 shadow-lg overflow-hidden"
      >
        {/* Header band */}
        <div className="bg-gold px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[2px] text-dark-bg/70">
              LAVO
            </div>
            <div className="text-[18px] font-black text-dark-bg leading-tight">
              {t('receipt_title')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-dark-bg/70">
              {t('receipt_issued_at')}
            </div>
            <div className="text-[12px] font-mono text-dark-bg">{issuedAt}</div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Station */}
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-[#888] mb-1">
              {t('receipt_station')}
            </div>
            <div className="text-[15px] font-bold">{station.name}</div>
            <div className="text-[13px] text-[#555]">{station.address}, {station.city}</div>
          </div>

          {/* Arrival */}
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-[#888] mb-1">
              {t('receipt_arrival')}
            </div>
            <div className="text-[14px] font-semibold">{arrivalLabel}</div>
            {arrivalMode === 'queue_later' && queuePosition != null && (
              <div className="text-[13px] text-[#555] mt-0.5">
                {t('result_queue_position_label')} <span className="font-bold text-gold">#{queuePosition}</span>
              </div>
            )}
          </div>

          {/* Service breakdown */}
          <div className="border-t border-dashed border-[#D0D0C0] pt-3 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold truncate">{serviceName}</div>
                {formatLabel && <div className="text-[12px] text-[#888]">{formatLabel}</div>}
              </div>
              <div className="text-[14px] font-mono shrink-0">{servicePrice.toLocaleString()} $</div>
            </div>

            {extras.map((ex) => (
              <div key={ex.id} className="flex items-baseline justify-between gap-3 text-[13px] text-[#555]">
                <span className="truncate">+ {ex.name}</span>
                <span className="font-mono shrink-0">{ex.price.toLocaleString()} $</span>
              </div>
            ))}

            {surchargeAmount > 0 && (
              <div className="flex items-baseline justify-between gap-3 text-[13px] text-[#555]">
                <span>{t('receipt_reservation_surcharge')}</span>
                <span className="font-mono shrink-0">{surchargeAmount.toLocaleString()} $</span>
              </div>
            )}

            {extrasTotal > 0 || surchargeAmount > 0 ? (
              <div className="flex items-baseline justify-between gap-3 text-[12px] text-[#888] pt-1">
                <span>{t('receipt_subtotal')}</span>
                <span className="font-mono">{(servicePrice + extrasTotal + surchargeAmount).toLocaleString()} $</span>
              </div>
            ) : null}
          </div>

          {/* Total */}
          <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-[13px] font-black uppercase tracking-wider text-[#0A0A14]">
              {t('receipt_total')}
            </span>
            <span className="text-[20px] font-black text-gold">{grandTotal.toLocaleString()} $</span>
          </div>

          {/* Ticket code */}
          <div className="bg-dark-bg text-white rounded-xl px-4 py-4">
            <div className="text-[10px] font-black uppercase tracking-[2px] text-gold mb-1.5">
              {t('receipt_ticket_label')}
            </div>
            <div className="text-[34px] font-black font-mono tracking-[0.4em] text-white leading-none mb-2">
              {ticketCode}
            </div>
            <p className="text-[12px] text-[#C0C0B0] leading-relaxed">
              {t('receipt_ticket_hint')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#F5F5E6] border-t border-[#E0E0D0] text-[11px] text-[#666] text-center">
          {t('receipt_footer')}
        </div>
      </div>

      {/* Actions (hidden when printing) */}
      <div className="lavo-receipt-actions flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t('receipt_download')}
        </button>
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex-1 inline-flex items-center justify-center gap-2 py-3 border-2 border-gold rounded-xl text-[14px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          {copied ? t('receipt_code_copied') : t('receipt_copy_code')}
        </button>
      </div>
    </div>
  );
}

/**
 * Generate a 6-character ticket code with digits + uppercase letters.
 * Avoids visually ambiguous characters (0/O, 1/I/L).
 *
 * TODO: replace with the value returned by the backend once the booking
 * endpoint persists a `ticket_code` on the entry.
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
