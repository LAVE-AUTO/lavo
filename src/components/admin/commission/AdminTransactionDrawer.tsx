'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { intlDateLocale } from '@/helpers/date-helper';
import { useToast } from '@/context/toast-context';
import { formatMoneyPrefix } from '@/helpers/money';
import { generateTransactionPdf, type PdfLabels } from './generateTransactionPdf';

export type TxStatus = 'succeeded' | 'refunded' | 'failed';
export type TxType = 'reservation' | 'tip' | 'penalty';

export interface TxRow {
  id: string; stripe_id: string; station: string; client: string;
  gross: number; commission: number; payout: number;
  status: TxStatus; date: string;
  /** Transaction family. Only `reservation` carries the detailed tax breakdown. */
  type: TxType;
  /** Localized type label shown in the list and drawer. */
  typeLabel: string;
  /* Detailed snapshot (reservation only; null for tip/penalty rows). */
  clientTotal: number | null;
  platformServiceFee: number | null;
  tps: number | null;
  tvq: number | null;
  platformRetained: number | null;
  stationTransferred: number | null;
}

const STATUS_STYLE: Record<TxStatus, { badge: string; dot: string; bar: string }> = {
  succeeded: { badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20', dot: 'bg-[#22C55E]', bar: 'bg-[#22C55E]' },
  refunded:  { badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#1E40AF]/20', dot: 'bg-[#1E40AF]', bar: 'bg-[#1E40AF]' },
  failed:    { badge: 'bg-[#FFF1F2] text-[#BE123C] ring-1 ring-[#FB7185]/20', dot: 'bg-[#F43F5E]', bar: 'bg-[#F43F5E]' },
};

function fmt(n: number) {
  return formatMoneyPrefix(n);
}
function formatDateTime(d: string, locale: string) {
  try { return new Date(d).toLocaleDateString(intlDateLocale(locale), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

interface Props { tx: TxRow | null; onClose: () => void; }

export function AdminTransactionDrawer({ tx, onClose }: Props) {
  const t = useTranslations('admin_transactions');
  const locale = useLocale();
  const { error: toastError } = useToast();
  const closeBtnRef   = useRef<HTMLButtonElement>(null);
  const mountedRef    = useRef(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const STATUS_LABELS: Record<TxStatus, string> = {
    succeeded: t('status_succeeded'),
    refunded:  t('status_refunded'),
    failed:    t('status_failed'),
  };

  useEffect(() => {
    if (!tx) return;
    closeBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tx, onClose]);

  async function handleDownload() {
    if (!tx || exporting) return;
    setExporting(true);
    try {
      const pdfLabels: PdfLabels = {
        pageTitle:       t('page_title'),
        receiptLabel:    t('pdf_receipt_label'),
        stripeIdLabel:   t('drawer_stripe_id'),
        grossLabel:      t('drawer_gross'),
        commissionLabel: t('drawer_commission'),
        payoutLabel:     t('drawer_payout'),
        stationLabel:    t('drawer_station'),
        clientLabel:     t('drawer_client'),
        typeLabel:       t('drawer_type'),
        clientTotalLabel:        t('drawer_client_total'),
        platformFeeLabel:        t('drawer_platform_fee'),
        tpsLabel:                t('drawer_tps'),
        tvqLabel:                t('drawer_tvq'),
        platformRetainedLabel:   t('drawer_platform_retained'),
        stationTransferredLabel: t('drawer_station_transferred'),
        sectionAmounts:  t('section_amounts'),
        sectionParties:  t('section_parties'),
        statusText:      STATUS_LABELS[tx.status],
        generatedOn:     t('pdf_generated_on'),
      };
      await generateTransactionPdf(tx, pdfLabels);
    } catch {
      if (mountedRef.current) toastError(t('error_export'));
    } finally {
      if (mountedRef.current) setExporting(false);
    }
  }

  if (!tx) return null;
  const s = STATUS_STYLE[tx.status];
  /* Only reservation rows carry the detailed tax breakdown. */
  const isReservation = tx.type === 'reservation' && tx.clientTotal != null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-white shadow-2xl ring-1 ring-black/[0.06] animate-fade-in-up dark:bg-[#131E10] dark:ring-white/[0.06]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#FFF9EC] bg-[#F9F8F5] px-6 py-4 dark:border-[#1E2E18] dark:bg-[#0E1A0C]">
          <h2 className="text-[14px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('drawer_title')}</h2>
          <button ref={closeBtnRef} type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-[#F0EDE6] hover:text-[#001201] dark:hover:bg-[#1E2E18] dark:hover:text-[#FFF9EC]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Status bar */}
        <div className={`h-1 w-full ${s.bar}`} />

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">

          {/* Status + date */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ${s.badge}`}>
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />{STATUS_LABELS[tx.status]}
            </span>
            <p className="text-[13px] text-foreground/55 dark:text-[#B0BFB1]">{formatDateTime(tx.date, locale)}</p>
          </div>

          {/* Amounts */}
          <div className="rounded-2xl border border-[#FFF9EC] bg-[#F9F8F5] p-5 dark:border-[#1E2E18] dark:bg-[#0E1A0C]">
            <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('section_amounts')}</p>
            <div className="flex flex-col gap-3">
              {/* Reservations expose the full tax/fee breakdown; tip and penalty
                  rows carry no snapshot, so they show a compact gross + net only. */}
              {isReservation ? (
                <>
                  <AmountRow label={t('drawer_client_total')} value={fmt(tx.clientTotal ?? tx.gross)} strong />
                  {tx.platformServiceFee != null && tx.platformServiceFee > 0 && (
                    <AmountRow label={t('drawer_platform_fee')} value={fmt(tx.platformServiceFee)} />
                  )}
                  {tx.tps != null && tx.tps > 0 && (
                    <AmountRow label={t('drawer_tps')} value={fmt(tx.tps)} />
                  )}
                  {tx.tvq != null && tx.tvq > 0 && (
                    <AmountRow label={t('drawer_tvq')} value={fmt(tx.tvq)} />
                  )}
                  <AmountRow label={t('drawer_commission')} value={fmt(tx.commission)} gold />
                  <div className="h-px bg-[#FFF9EC] dark:bg-[#1E2E18]" />
                  <AmountRow label={t('drawer_platform_retained')} value={fmt(tx.platformRetained ?? tx.commission)} gold />
                  <div className="flex justify-between">
                    <span className="text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{t('drawer_station_transferred')}</span>
                    <span className="text-[17px] font-black text-[#5A8A50] dark:text-[#7AAA6A]">{fmt(tx.stationTransferred ?? tx.payout)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{t('drawer_gross')}</span>
                  <span className="text-[17px] font-black text-[#001201] dark:text-[#FFF9EC]">{fmt(tx.gross)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Parties */}
          <div className="rounded-2xl border border-[#FFF9EC] bg-[#F9F8F5] p-5 dark:border-[#1E2E18] dark:bg-[#0E1A0C]">
            <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('section_parties')}</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-foreground/65 dark:text-[#B0BFB1]">{t('drawer_type')}</span>
                <span className="text-right text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{tx.typeLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-foreground/65 dark:text-[#B0BFB1]">{t('drawer_station')}</span>
                <span className="text-right text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{tx.station}</span>
              </div>
            </div>
          </div>

          {/* Stripe ID */}
          <div className="rounded-2xl border border-[#FFF9EC] bg-[#F9F8F5] p-5 dark:border-[#1E2E18] dark:bg-[#0E1A0C]">
            <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('drawer_stripe_id')}</p>
            <p className="break-all font-mono text-[12px] leading-relaxed text-foreground/70 dark:text-[#B0BFB1]">{tx.stripe_id}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#FFF9EC] p-5 dark:border-[#1E2E18]">
          <button type="button" onClick={handleDownload} disabled={exporting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#DDAF3B] px-5 py-3 text-[13px] font-bold text-[#001201] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#D4A830] hover:shadow-md active:translate-y-0 disabled:opacity-60 disabled:translate-y-0">
            {exporting
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#001201] border-t-transparent" />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            }
            {t('btn_download')}
          </button>
        </div>
      </div>
    </>
  );
}

/** One label/value line inside the drawer's amounts section. */
function AmountRow({ label, value, strong, gold }: { label: string; value: string; strong?: boolean; gold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[13px] text-foreground/65 dark:text-[#B0BFB1]">{label}</span>
      <span className={[
        strong ? 'text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]' : 'text-[14px] font-bold',
        gold ? 'text-[#DDAF3B]' : strong ? '' : 'text-[#001201] dark:text-[#FFF9EC]',
      ].join(' ')}>{value}</span>
    </div>
  );
}
