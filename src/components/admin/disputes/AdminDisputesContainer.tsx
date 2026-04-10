'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services/axios-service';
import type { DisputeRow } from './disputes-mock';
import { AdminDisputesList } from './AdminDisputesList';

function mapApiStatus(s: string): DisputeRow['status'] {
  if (s === 'refunded') return 'refunded_full';
  if (s === 'resolved' || s === 'rejected') return 'closed';
  return 'open';
}

interface ApiDispute {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  requested_amount: string | null;
  refunded_amount: string | null;
  client_id: string;
  station_id: string;
  reservation_id: string;
  created_at: string;
  station: { id: string; name: string; city: string; address: string } | null;
}

export function AdminDisputesContainer() {
  const t = useTranslations('admin_disputes');
  const [query, setQuery] = useState('');
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const [ok, data] = await getFromApi('/admin/disputes');
      if (!mountedRef.current) return;

      if (ok) {
        const result = (data as { data: { items: ApiDispute[] } }).data;
        const items = (result?.items ?? []).map((d): DisputeRow => ({
          id: d.id,
          client: { name: d.client_id.slice(0, 8), email: '' },
          station: { name: d.station?.name ?? '', city: d.station?.city ?? '' },
          reservation: { id: d.reservation_id, date: d.created_at, amount_paid: parseFloat(d.requested_amount ?? '0'), vehicle_format: '', status: '' },
          reason: d.reason,
          status: mapApiStatus(d.status),
          created_at: d.created_at,
          events: [{ id: `e-${d.id}`, date: d.created_at, label: d.reason, by: 'client' as const }],
        }));
        setDisputes(items);
        setFetchError(false);
      } else {
        setFetchError(true);
      }
    } catch {
      if (!mountedRef.current) return;
      setFetchError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const open  = disputes.filter((d) => d.status === 'open').length;
  const total = disputes.length;

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 pb-0 pt-6 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
            <p className="mt-1 text-[13px] text-[#888] dark:text-[#9A9A8A]">{t('page_subtitle')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            {open > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-[#F97316]/30 bg-[#FFF4EC] px-3 py-1 text-[12px] font-black text-[#C2410C] dark:border-[#F97316]/20 dark:bg-[#2A1408]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F97316] opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F97316]" />
                </span>
                {open} {t('chip_open')}
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-full border border-[#D8D4C8] bg-white px-3 py-1 text-[12px] font-bold text-[#888] dark:border-[#243020] dark:bg-[#131E10] dark:text-[#A0A090]">
              {total} {t('chip_total')}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="mt-5 flex items-end justify-end pb-0">
          <div className="relative mb-2.5">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBBBAA]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search_placeholder')}
              className="w-[220px] rounded-[8px] border border-[#D8D4C8] bg-white py-1.5 pl-8 pr-3 text-[13px] text-[#1A1A0A] outline-none transition-all focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] focus:ring-0 dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="text-[13px] font-semibold text-[#999] dark:text-[#9A9A8A]">{t('fetch_error')}</p>
            <button type="button" onClick={loadDisputes} className="rounded-xl bg-[#C49A1E] px-4 py-2 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14]">
              {t('btn_retry')}
            </button>
          </div>
        ) : (
          <AdminDisputesList disputes={disputes} query={query} />
        )}
      </div>
    </div>
  );
}
