'use client';

import { useTranslations } from 'next-intl';

export interface HistoryReservation {
  id: string;
  stationName: string;
  stationAddress: string;
  vehicleFormatLabel: string | null;
  serviceName: string | null;
  serviceCategory: string | null;
  entryType: 'reservation' | 'queue';
  amountPaid: number;
  /** Tip portion of amountPaid; surfaced separately in the receipt. */
  tipAmount: number | null;
  status: 'completed' | 'cancelled';
  createdAt: string;
}

interface HistoryCardProps {
  entry: HistoryReservation;
  locale: string;
  onSelect: () => void;
}

/* Stable colored monogram for the station avatar - hash of the name. */
function stationGradient(name: string): string {
  const palette = [
    'from-[#DDAF3B] to-[#DDAF3B]',
    'from-[#001A05] to-[#4a8b3e]',
    'from-[#001201] to-[#001A05]',
    'from-[#DDAF3B] to-[#DDAF3B]',
    'from-[#4A3818] to-[#7A5A2E]',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function formatAmount(amount: number, locale: string): string {
  return `$${amount.toLocaleString(locale === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Compact "ticket" card for a single history entry.
 * Tapping it opens the receipt modal. Completed entries show a chevron;
 * cancelled entries are visually subdued but still openable.
 */
export function HistoryCard({ entry: e, locale, onSelect }: HistoryCardProps) {
  const t = useTranslations('history');

  const initials = e.stationName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'SW';

  const date = new Date(e.createdAt);
  const dateLabel = date.toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );
  const timeLabel = date.toLocaleTimeString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { hour: '2-digit', minute: '2-digit' },
  );

  const typeLabel = e.entryType === 'queue' ? t('receipt_entry_type_queue') : t('receipt_entry_type_reservation');
  const isCompleted = e.status === 'completed';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left bg-surface rounded-2xl border overflow-hidden',
        'transition-all hover:border-gold/40 hover:shadow-sm cursor-pointer',
        isCompleted
          ? 'border-border'
          : 'border-border/60 dark:border-border/60 opacity-90',
      ].join(' ')}
    >
      <div className="flex items-stretch">
        {/* Monogram strip */}
        <div className={`w-14 sm:w-16 shrink-0 bg-linear-to-br ${stationGradient(e.stationName)} flex items-center justify-center text-white`}>
          <span className="text-[14px] sm:text-[15px] font-black tracking-wider">{initials}</span>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 px-4 py-3.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-black text-foreground truncate leading-tight">{e.stationName}</p>
              {e.stationAddress && (
                <p className="text-[11.5px] text-foreground/55 dark:text-[#B0BFB1] mt-0.5 truncate">{e.stationAddress}</p>
              )}
            </div>
            <span className={[
              'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider',
              isCompleted
                ? 'bg-Hurryline-success/15 text-Hurryline-success border border-Hurryline-success/30'
                : 'bg-Hurryline-error/15 text-Hurryline-error border border-Hurryline-error/30',
            ].join(' ')}>
              <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-Hurryline-success' : 'bg-Hurryline-error'}`} />
              {t(`status_${e.status}`)}
            </span>
          </div>

          {/* Meta row - date / type / vehicle */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[11.5px] text-foreground/65 dark:text-[#B0BFB1]">
            <span className="inline-flex items-center gap-1 font-bebas tracking-wider text-[12.5px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8"  y1="2" x2="8"  y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {dateLabel}
            </span>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1 font-bebas tracking-wider text-[12.5px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {timeLabel}
            </span>
            {e.serviceName && (
              <>
                <span className="opacity-50">·</span>
                <span className="font-semibold">{e.serviceName}</span>
              </>
            )}
            <span className="opacity-50">·</span>
            <span className="font-semibold">{typeLabel}</span>
          </div>

          {/* Amount + tip line */}
          <div className="mt-3 flex items-end justify-between gap-2 pt-2.5 border-t border-dashed border-border">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#999] dark:text-[#8A8A82]">
              {t('amount_paid')}
            </p>
            <div className="text-right">
              <p className={`text-[18px] font-black leading-none ${isCompleted ? 'text-gold' : 'text-foreground/55'}`}>
                {formatAmount(e.amountPaid, locale)}
              </p>
              {e.tipAmount != null && e.tipAmount > 0 && (
                <p className="text-[10.5px] font-semibold text-foreground/55 dark:text-[#B0BFB1] mt-0.5">
                  {t('includes_tip', { amount: formatAmount(e.tipAmount, locale) })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Chevron / action hint */}
        <div className="hidden sm:flex items-center pr-3 pl-1 shrink-0">
          <span className="w-8 h-8 rounded-full bg-gold/10 text-gold flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </div>
      </div>
    </button>
  );
}
