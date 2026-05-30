'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services/axios-service';
import { ApiCode } from '@/types/api-codes';
import { SupportCreateForm } from './SupportCreateForm';
import { SupportTicketCard } from './SupportTicketCard';
import type { SupportTicketSummary } from '../support-types';
import { mapApiStatus } from '../support-types';

type LoadErrorKind = 'server' | 'rate_limited' | 'forbidden' | 'unauthorized' | 'network' | 'generic';

function resolveErrorKind(code: unknown): LoadErrorKind {
  switch (code) {
    case ApiCode.INTERNAL_ERROR:
    case ApiCode.NOT_IMPLEMENTED:
      return 'server';
    case ApiCode.TOO_MANY_REQUESTS:
      return 'rate_limited';
    case ApiCode.FORBIDDEN:
      return 'forbidden';
    case ApiCode.UNAUTHORIZED:
    case ApiCode.TOKEN_EXPIRED:
      return 'unauthorized';
    case undefined:
    case null:
      return 'network';
    default:
      return 'generic';
  }
}

const STATS: Array<{ key: 'open' | 'in_progress' | 'resolved' | 'closed'; label: string; dot: string }> = [
  { key: 'open',        label: 'status_open',        dot: 'bg-[#F97316]' },
  { key: 'in_progress', label: 'status_in_progress', dot: 'bg-[#1E40AF]' },
  { key: 'resolved',    label: 'status_resolved',    dot: 'bg-[#22C55E]' },
  { key: 'closed',      label: 'status_closed',      dot: 'bg-[#94A3B8]' },
];

interface Props {
  sectionLabel?: string;
}

export function ClientSupportContainer({ sectionLabel }: Props) {
  const t = useTranslations('client_support');
  const [showForm, setShowForm] = useState(false);
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrorKind, setLoadErrorKind] = useState<LoadErrorKind | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setLoadErrorKind(null);
    const [ok, data] = await getFromApi<{ data: { items: SupportTicketSummary[] } }>('/support?limit=100');
    if (!mountedRef.current) return;
    if (ok && 'data' in (data as object)) {
      const items = (data as { data?: { items?: SupportTicketSummary[] } }).data?.items ?? [];
      setTickets(items);
    } else {
      const code = (data as { code?: string } | undefined)?.code;
      setLoadErrorKind(resolveErrorKind(code));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const counts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  for (const tk of Array.isArray(tickets) ? tickets : []) {
    const mapped = mapApiStatus(tk.status);
    if (mapped in counts) counts[mapped as keyof typeof counts]++;
  }

  function handleCreated() {
    setShowForm(false);
    loadTickets();
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-surface px-6 pb-5 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
              </span>
              <h1 className="text-[20px] font-black tracking-tight text-foreground">{t('page_title')}</h1>
            </div>
            <p className="mt-1 text-[13px] text-foreground/60">{t('page_subtitle')}</p>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-shine flex shrink-0 items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-[13px] font-bold text-background shadow-sm transition-all hover:bg-gold-hover hover:shadow-md active:scale-[0.98]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('btn_new_ticket')}
            </button>
          )}
        </div>

        {/* Stats row */}
        {tickets.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {STATS.map(({ key, label, dot }) => counts[key] > 0 && (
              <span key={key} className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-bold text-foreground/70">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {counts[key]} {t(label)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">

          {/* Create form */}
          {showForm && (
            <SupportCreateForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
            </div>
          )}

          {/* Error state */}
          {!loading && loadErrorKind && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex flex-col items-center gap-3 rounded-2xl border border-Hurryline-error/30 bg-Hurryline-error/10 px-4 py-6 text-center"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF383C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-[13px] font-semibold text-Hurryline-error">
                {t(`error_load_${loadErrorKind}`)}
              </p>
              <button
                type="button"
                onClick={loadTickets}
                aria-label={t('btn_retry_aria')}
                className="rounded-xl border border-gold/50 px-4 py-2 text-[13px] font-bold text-gold transition-colors hover:bg-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {t('btn_retry')}
              </button>
            </div>
          )}

          {/* Ticket list */}
          {!loading && !loadErrorKind && (
            <div className="flex flex-col gap-3">
              {!showForm && (
                <h2 className="text-[10.5px] font-black uppercase tracking-[0.15em] text-foreground/55">
                  {sectionLabel ?? t('section_tickets')}
                </h2>
              )}
              {tickets.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-20 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div className="max-w-xs">
                    <p className="text-[15px] font-black text-foreground">{t('empty_tickets')}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/55">{t('empty_tickets_hint')}</p>
                  </div>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <SupportTicketCard key={ticket.id} ticket={ticket} onMessageSent={loadTickets} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
