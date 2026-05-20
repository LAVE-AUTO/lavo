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

// ─── Details rendering ────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  first_name: 'Prénom',
  last_name: 'Nom',
  email: 'Email',
  phone: 'Téléphone',
  status: 'Statut',
  name: 'Nom',
  city: 'Ville',
  address: 'Adresse',
  is_active: 'Actif',
  is_visible: 'Visible',
  promo_ref_code: 'Code promo',
  promo_commission_rate: 'Commission promo',
  promo_ref_generated_at: 'Généré le',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert', refunded: 'Remboursé', resolved: 'Résolu', rejected: 'Rejeté',
  active: 'Actif', blocked: 'Bloqué', pending: 'En attente',
};

function fmtValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'oui' : 'non';
  const s = String(val);
  if (key === 'promo_commission_rate') {
    const n = parseFloat(s);
    return Number.isFinite(n) ? `${Math.round(n * 100 * 10) / 10} %` : s;
  }
  if (key === 'promo_ref_generated_at') {
    try { return new Date(s).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return s; }
  }
  if (key === 'status') return STATUS_LABELS[s] ?? s;
  return s;
}

function Arrow() {
  return <span className="text-[#BBBBAA] dark:text-[#505040]">→</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="text-[#8A8A7A] dark:text-[#7A7A6A]">{label} :</span>
      <span className="text-[#3A3A2A] dark:text-[#C8C5AE]">{children}</span>
    </div>
  );
}

function DiffRows({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const changedKeys = Object.keys({ ...before, ...after }).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
  if (changedKeys.length === 0) return <p className="text-[#AAAAAA]">Aucun changement détecté.</p>;
  return (
    <>
      {changedKeys.map((k) => (
        <Row key={k} label={FIELD_LABELS[k] ?? k}>
          <span className="line-through opacity-60">{fmtValue(k, before[k])}</span>{' '}
          <Arrow /> {fmtValue(k, after[k])}
        </Row>
      ))}
    </>
  );
}

function DetailsContent({ action, details }: { action: string; details: Record<string, unknown> }) {
  // commission_rate_updated: { previous_rate, new_rate } (decimal fractions)
  if (action === 'commission_rate_updated') {
    const prev = parseFloat(String(details.previous_rate ?? '')) * 100;
    const next = parseFloat(String(details.new_rate ?? '')) * 100;
    return (
      <Row label="Taux de commission">
        <span className="line-through opacity-60">{Number.isFinite(prev) ? `${Math.round(prev * 10) / 10} %` : '—'}</span>{' '}
        <Arrow /> {Number.isFinite(next) ? `${Math.round(next * 10) / 10} %` : '—'}
      </Row>
    );
  }

  // REFUND_DISPUTE: { amount, stripe_refund_id, previous_status, new_status }
  if (action === 'REFUND_DISPUTE') {
    return (
      <>
        {details.amount != null && <Row label="Montant remboursé">{String(details.amount)} XAF</Row>}
        {details.stripe_refund_id && (
          <Row label="Réf. Stripe">
            <span className="font-mono text-[10px]">{String(details.stripe_refund_id).slice(0, 20)}…</span>
          </Row>
        )}
      </>
    );
  }

  // CLOSE_DISPUTE: { previous_status, new_status, reason }
  if (action === 'CLOSE_DISPUTE') {
    return (
      <>
        <Row label="Statut">
          <span className="line-through opacity-60">{STATUS_LABELS[String(details.previous_status ?? '')] ?? String(details.previous_status)}</span>{' '}
          <Arrow /> {STATUS_LABELS[String(details.new_status ?? '')] ?? String(details.new_status)}
        </Row>
        {details.reason && <Row label="Motif">{String(details.reason)}</Row>}
      </>
    );
  }

  // toggle_rating_visibility: { score, previous_is_visible, new_is_visible, station_id }
  if (action === 'toggle_rating_visibility') {
    return (
      <>
        {details.score != null && <Row label="Note">{String(details.score)}/5</Row>}
        <Row label="Visibilité">
          <span className="line-through opacity-60">{details.previous_is_visible ? 'Visible' : 'Masqué'}</span>{' '}
          <Arrow /> {details.new_is_visible ? 'Visible' : 'Masqué'}
        </Row>
      </>
    );
  }

  // station_approved: { stripe_account_id, stripe_connected }
  if (action === 'station_approved') {
    return <Row label="Stripe">Compte connecté avec succès</Row>;
  }

  // station_rejected: { reason }
  if (action === 'station_rejected') {
    return details.reason
      ? <Row label="Motif du rejet">{String(details.reason)}</Row>
      : null;
  }

  // Diff actions: UPDATE_USER, UPDATE_STATION, UNBLOCK_ACCOUNT, UPDATE_STATION_PROMO_QR
  if ('before' in details && 'after' in details) {
    return (
      <DiffRows
        before={details.before as Record<string, unknown>}
        after={details.after as Record<string, unknown>}
      />
    );
  }

  // Fallback: show key: value pairs (no raw JSON)
  return (
    <>
      {Object.entries(details).map(([k, v]) => (
        <Row key={k} label={FIELD_LABELS[k] ?? k}>{fmtValue(k, v)}</Row>
      ))}
    </>
  );
}

function DetailExpander({ action, details }: { action: string; details: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  if (Object.keys(details).length === 0) return null;
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
        {open ? 'Masquer les détails' : 'Voir les détails'}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1 rounded-lg bg-[#F5F2EC] px-3 py-2.5 text-[12px] dark:bg-[#0E1A0C]">
          <DetailsContent action={action} details={details} />
        </div>
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
          <DetailExpander action={entry.action} details={entry.details} />
        )}
      </div>

      {/* Desktop: 4-column grid */}
      <div className="hidden sm:grid sm:grid-cols-[2fr_1.5fr_1.5fr_1fr] sm:items-start sm:gap-4">
        {/* Action */}
        <div className="flex flex-col gap-1.5">
          <ActionBadge action={entry.action} label={actionLabel} />
          {entry.details && Object.keys(entry.details).length > 0 && (
            <DetailExpander action={entry.action} details={entry.details} />
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
