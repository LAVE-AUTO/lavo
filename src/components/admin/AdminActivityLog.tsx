'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi } from '@/services/axios-service';

// ─── Types ──────────────────────────────────────────────────────────────────

type LogEntry = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  admin_id: string;
  admin_name: string;
  admin_email: string;
};

type Meta = { total: number; page: number; per_page: number; total_pages: number };

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_ACTIONS = [
  'UPDATE_USER',
  'UNBLOCK_ACCOUNT',
  'UPDATE_STATION',
  'station_approved',
  'station_rejected',
  'REFUND_DISPUTE',
  'CLOSE_DISPUTE',
  'toggle_rating_visibility',
  'UPDATE_STATION_PROMO_QR',
  'commission_rate_updated',
] as const;

type ActionBadgeVariant = 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'gray';

const ACTION_VARIANT: Record<string, ActionBadgeVariant> = {
  station_approved:           'green',
  station_rejected:           'red',
  UNBLOCK_ACCOUNT:            'green',
  REFUND_DISPUTE:             'blue',
  CLOSE_DISPUTE:              'gray',
  commission_rate_updated:    'amber',
  UPDATE_STATION_PROMO_QR:    'purple',
  UPDATE_USER:                'blue',
  UPDATE_STATION:             'blue',
  toggle_rating_visibility:   'amber',
};

const BADGE_CLASSES: Record<ActionBadgeVariant, string> = {
  green:  'bg-[#22C55E]/10 text-[#16A34A] dark:text-[#4ADE80]',
  red:    'bg-[#EF4444]/10 text-[#DC2626] dark:text-[#F87171]',
  blue:   'bg-[#3B82F6]/10 text-[#2563EB] dark:text-[#60A5FA]',
  amber:  'bg-[#C49A1E]/10 text-[#7A5E0A] dark:text-[#C49A1E]',
  purple: 'bg-[#8B5CF6]/10 text-[#7C3AED] dark:text-[#A78BFA]',
  gray:   'bg-[#6B7280]/10 text-[#4B5563] dark:text-[#9CA3AF]',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' · '
      + d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function shortId(id: string | null) {
  return id ? id.slice(0, 8) + '…' : '—';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ActionBadge({ action, label }: { action: string; label: string }) {
  const variant = ACTION_VARIANT[action] ?? 'gray';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${BADGE_CLASSES[variant]}`}>
      {label}
    </span>
  );
}

function FilterPill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition-all',
        active
          ? 'bg-[#C49A1E] text-[#0C1209]'
          : 'bg-[#F0EDE6] text-[#6B6B5A] hover:bg-[#E8E4DC] dark:bg-[#1E2E18] dark:text-[#A0A090] dark:hover:bg-[#253020]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function DetailExpander({ details }: { details: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(details);
  if (keys.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-bold text-[#AAAAAA] hover:text-[#C49A1E] dark:text-[#A0A090] dark:hover:text-[#C49A1E]"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
          style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}>
          <path d="M3 1.5l4 3.5-4 3.5V1.5z"/>
        </svg>
        {open ? 'Masquer les détails' : `${keys.length} détail${keys.length > 1 ? 's' : ''}`}
      </button>
      {open && (
        <pre className="mt-1.5 overflow-x-auto rounded-lg bg-[#F5F2EC] p-3 text-[11px] text-[#4A4A3A] dark:bg-[#0E1A0C] dark:text-[#A0A090]">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminActivityLog() {
  const t = useTranslations('admin_logs');
  const { error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [items, setItems]           = useState<LogEntry[]>([]);
  const [meta, setMeta]             = useState<Meta | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [page, setPage]             = useState(1);

  const fetchPage = useCallback(async (p: number, action: string | null, replace: boolean) => {
    const params = new URLSearchParams({ page: String(p), per_page: '25' });
    if (action) params.set('action', action);

    const [ok, data] = await getFromApi(`/admin/logs?${params.toString()}`);
    if (!mountedRef.current) return;
    if (!ok) { toastError('Impossible de charger les logs.'); return; }

    const payload = (data as { data: { items: LogEntry[]; meta: Meta } }).data;
    setItems((prev) => replace ? payload.items : [...prev, ...payload.items]);
    setMeta(payload.meta);
    setPage(p);
  }, [toastError]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchPage(1, actionFilter, true).finally(() => {
      if (mountedRef.current) setLoading(false);
    });
  }, [actionFilter, fetchPage]);

  async function handleLoadMore() {
    if (!meta || page >= meta.total_pages) return;
    setLoadingMore(true);
    await fetchPage(page + 1, actionFilter, false);
    if (mountedRef.current) setLoadingMore(false);
  }

  function handleActionFilter(action: string | null) {
    setActionFilter(action);
    setItems([]);
  }

  const hasMore = meta ? page < meta.total_pages : false;
  const isEmpty = !loading && items.length === 0;

  return (
    <div className="flex min-h-full flex-col">

      {/* Header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-4 py-5 sm:px-6 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[20px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
            <p className="mt-0.5 text-[13px] text-[#888] dark:text-[#9A9A8A]">{t('page_subtitle')}</p>
          </div>
          {meta && (
            <span className="self-start rounded-full bg-[#1A1A0A]/8 px-3 py-1 text-[12px] font-black text-[#6B6B5A] dark:bg-white/8 dark:text-[#A0A090]">
              {meta.total} entrée{meta.total > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="shrink-0 overflow-x-auto border-b border-[#E8E4DC] bg-[#F9F8F5] px-4 py-3 sm:px-6 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
        <div className="flex gap-2">
          <FilterPill
            label={t('filter_all_actions')}
            active={actionFilter === null}
            onClick={() => handleActionFilter(null)}
          />
          {ALL_ACTIONS.map((a) => (
            <FilterPill
              key={a}
              label={t(`action_${a}` as Parameters<typeof t>[0])}
              active={actionFilter === a}
              onClick={() => handleActionFilter(a)}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5EE] dark:bg-[#0C1209]">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EDE6] dark:bg-[#1A2A14]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#AAAAAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <p className="text-[14px] text-[#AAAAAA] dark:text-[#A0A090]">
              {actionFilter ? t('empty_filtered') : t('empty')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EEEBe4] dark:divide-[#1A2A14]">
            {items.map((entry) => (
              <LogRow key={entry.id} entry={entry} t={t} />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="flex justify-center py-6">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 rounded-xl border border-[#D8D4C8] bg-white px-5 py-2.5 text-[13px] font-bold text-[#4A4A3A] transition-all hover:border-[#C49A1E] hover:text-[#C49A1E] disabled:opacity-50 dark:border-[#243020] dark:bg-[#131E10] dark:text-[#A0A090] dark:hover:border-[#C49A1E]"
            >
              {loadingMore
                ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#C49A1E] border-t-transparent" />Chargement…</>
                : t('load_more')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Log row ─────────────────────────────────────────────────────────────────

function LogRow({ entry, t }: { entry: LogEntry; t: ReturnType<typeof useTranslations<'admin_logs'>> }) {
  const actionKey = `action_${entry.action}` as Parameters<typeof t>[0];
  const targetKey = entry.target_type ? (`target_${entry.target_type}` as Parameters<typeof t>[0]) : null;
  const actionLabel = t.has(actionKey) ? t(actionKey) : entry.action;
  const targetLabel = targetKey && t.has(targetKey) ? t(targetKey) : entry.target_type;

  return (
    <div className="bg-white px-4 py-4 transition-colors hover:bg-[#FAFAF7] sm:px-6 dark:bg-[#131E10] dark:hover:bg-[#182416]">

      {/* Mobile: stacked layout */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-start justify-between gap-2">
          <ActionBadge action={entry.action} label={actionLabel} />
          <time className="shrink-0 text-[11px] text-[#BBBBAA] dark:text-[#A0A090]">
            {formatDateTime(entry.created_at)}
          </time>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#666] dark:text-[#9A9A8A]">
          {targetLabel && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#CCCCBB]" />
              {targetLabel}
              {entry.target_id && (
                <span className="font-mono text-[10px] text-[#AAAAAA]">{shortId(entry.target_id)}</span>
              )}
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#CCCCBB]" />
            {entry.admin_name}
          </span>
        </div>
        {entry.details && Object.keys(entry.details).length > 0 && (
          <DetailExpander details={entry.details} />
        )}
      </div>

      {/* Desktop: 4-column grid */}
      <div className="hidden sm:grid sm:grid-cols-[2fr_1.5fr_1.5fr_1fr] sm:items-start sm:gap-4">
        {/* Action */}
        <div className="flex flex-col gap-1.5">
          <ActionBadge action={entry.action} label={actionLabel} />
          {entry.details && Object.keys(entry.details).length > 0 && (
            <DetailExpander details={entry.details} />
          )}
        </div>

        {/* Target */}
        <div className="flex flex-col gap-0.5 pt-0.5">
          {targetLabel
            ? <span className="text-[13px] font-semibold text-[#3A3A2A] dark:text-[#D0CDB8]">{targetLabel}</span>
            : <span className="text-[12px] text-[#AAAAAA]">—</span>}
          {entry.target_id && (
            <span className="font-mono text-[11px] text-[#BBBBAA] dark:text-[#A0A090]">
              {shortId(entry.target_id)}
            </span>
          )}
        </div>

        {/* Admin */}
        <div className="flex flex-col gap-0.5 pt-0.5">
          <span className="text-[13px] font-semibold text-[#3A3A2A] dark:text-[#D0CDB8]">{entry.admin_name}</span>
          {entry.admin_email && (
            <span className="text-[11px] text-[#BBBBAA] dark:text-[#A0A090]">{entry.admin_email}</span>
          )}
        </div>

        {/* Date */}
        <div className="pt-0.5 text-right">
          <time className="text-[12px] text-[#BBBBAA] dark:text-[#A0A090]">
            {formatDateTime(entry.created_at)}
          </time>
        </div>
      </div>

    </div>
  );
}
