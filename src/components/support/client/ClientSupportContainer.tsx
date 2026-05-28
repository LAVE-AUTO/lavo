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
  { key: 'in_progress', label: 'status_in_progress', dot: 'bg-[#3B82F6]' },
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
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 pb-4 pt-5 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('page_title')}</h1>
            <p className="mt-0.5 text-[12px] text-foreground/55 dark:text-[#6A6A5A]">{t('page_subtitle')}</p>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex shrink-0 items-center gap-2 rounded-[10px] bg-[#DDAF3B] px-4 py-2.5 text-[13px] font-bold text-[#0C1209] shadow-sm transition-all hover:bg-[#D4A830] hover:shadow-md active:scale-[0.98]"
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
              <span key={key} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-foreground/70 shadow-sm ring-1 ring-[#E8E4DC] dark:bg-[#131E10] dark:text-[#9A9A8A] dark:ring-[#1E2E18]">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {counts[key]} {t(label)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">

          {/* Create form */}
          {showForm && (
            <SupportCreateForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
            </div>
          )}

          {/* Error state */}
          {!loading && loadErrorKind && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex flex-col items-center gap-3 rounded-[10px] border border-[#391C01]/30 bg-[#391C01]/5 px-4 py-6 text-center dark:border-[#391C01]/40 dark:bg-[#391C01]/10"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#391C01" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-[13px] font-semibold text-[#B2351F] dark:text-[#F0A090]">
                {t(`error_load_${loadErrorKind}`)}
              </p>
              <button
                type="button"
                onClick={loadTickets}
                aria-label={t('btn_retry_aria')}
                className="rounded-[10px] border border-[#DDAF3B]/50 px-4 py-2 text-[13px] font-semibold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B]"
              >
                {t('btn_retry')}
              </button>
            </div>
          )}

          {/* Ticket list */}
          {!loading && !loadErrorKind && (
            <div className="flex flex-col gap-3">
              {!showForm && (
                <h2 className="text-[11px] font-black uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">
                  {sectionLabel ?? t('section_tickets')}
                </h2>
              )}
              {tickets.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4DC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-semibold text-[#999]">{t('empty_tickets')}</p>
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
