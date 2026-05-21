'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi } from '@/services/axios-service';
import { AdminPagination } from './ui/AdminPagination';

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

type ActionBadgeVariant = 'success' | 'danger' | 'warning' | 'neutral';

const ACTION_VARIANT: Record<string, ActionBadgeVariant> = {
  station_approved:           'success',
  UNBLOCK_ACCOUNT:            'success',
  station_rejected:           'danger',
  REFUND_DISPUTE:             'warning',
  CLOSE_DISPUTE:              'neutral',
  commission_rate_updated:    'warning',
  UPDATE_STATION_PROMO_QR:    'warning',
  UPDATE_USER:                'neutral',
  UPDATE_STATION:             'neutral',
  toggle_rating_visibility:   'neutral',
};

const BADGE_CLASSES: Record<ActionBadgeVariant, string> = {
  success: 'bg-[#F4F1E8] text-[#166534] ring-1 ring-inset ring-[#22C55E]/15 dark:bg-[#171F12] dark:text-[#86EFAC] dark:ring-[#22C55E]/15',
  danger:  'bg-[#FBF1F2] text-[#9F1239] ring-1 ring-inset ring-[#F43F5E]/15 dark:bg-[#1F1414] dark:text-[#FDA4AF] dark:ring-[#F43F5E]/15',
  warning: 'bg-[#FBF6E8] text-[#7A5E0A] ring-1 ring-inset ring-[#C49A1E]/20 dark:bg-[#1F1A0E] dark:text-[#F0D98C] dark:ring-[#C49A1E]/20',
  neutral: 'bg-[#F4F2EC] text-[#5A554B] ring-1 ring-inset ring-[#1A1A0A]/8  dark:bg-[#171F12] dark:text-[#A6A091] dark:ring-[#F0EDD4]/10',
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function ActionBadge({ action, label }: { action: string; label: string }) {
  const variant = ACTION_VARIANT[action] ?? 'neutral';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${BADGE_CLASSES[variant]}`}>
      {label}
    </span>
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

function DetailExpander({ action, details, tDetails }: { action: string; details: Record<string, unknown>; tDetails: { show: string; hide: string } }) {
  const [open, setOpen] = useState(false);
  if (Object.keys(details).length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-bold text-[#9B9588] hover:text-[#C49A1E] dark:text-[#7E8A75] dark:hover:text-[#F0D98C]"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"
          style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}>
          <path d="M3 1.5l4 3.5-4 3.5V1.5z"/>
        </svg>
        {open ? tDetails.hide : tDetails.show}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1 rounded-[12px] bg-[#F5F2EC] px-3 py-2.5 text-[12px] dark:bg-[#0E1A0C]">
          <DetailsContent action={action} details={details} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const PER_PAGE = 25;

export function AdminActivityLog() {
  const t = useTranslations('admin_logs');
  const { error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [items, setItems]               = useState<LogEntry[]>([]);
  const [meta, setMeta]                 = useState<Meta | null>(null);
  const [loading, setLoading]           = useState(true);
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [page, setPage]                 = useState(1);

  const fetchPage = useCallback(async (p: number, action: string | null) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), per_page: String(PER_PAGE) });
    if (action) params.set('action', action);

    const [ok, data] = await getFromApi(`/admin/logs?${params.toString()}`);
    if (!mountedRef.current) return;
    if (!ok) {
      toastError(t('load_error'));
      setLoading(false);
      return;
    }

    const payload = (data as { data: { items: LogEntry[]; meta: Meta } }).data;
    setItems(payload.items);
    setMeta(payload.meta);
    setPage(p);
    setLoading(false);
  }, [toastError, t]);

  useEffect(() => { fetchPage(1, actionFilter); }, [actionFilter, fetchPage]);

  function handleActionFilter(action: string | null) {
    setActionFilter(action);
  }

  const isEmpty = !loading && items.length === 0;

  const today = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return items.filter((i) => new Date(i.created_at) >= start).length;
  }, [items]);
  const distinctActions = new Set(items.map((i) => i.action)).size;
  const distinctAdmins  = new Set(items.map((i) => i.admin_id)).size;

  const metrics = [
    { label: t('metric_total'),          value: loading ? '…' : String(meta?.total ?? 0), accent: '#C49A1E' },
    { label: t('metric_today'),          value: loading ? '…' : String(today),            accent: '#22C55E' },
    { label: t('metric_active_actions'), value: loading ? '…' : String(distinctActions),  accent: '#3B82F6' },
    { label: t('metric_active_admins'),  value: loading ? '…' : String(distinctAdmins),   accent: '#94A3B8' },
  ];

  const filterPill = (active: boolean) => [
    'shrink-0 rounded-[14px] px-3.5 py-2 text-[12.5px] font-bold transition-colors duration-150',
    active
      ? 'bg-[#1A1A0A] text-[#F0EDD4] shadow-[0_10px_20px_rgba(26,26,10,0.18)] dark:bg-[#F0EDD4] dark:text-[#1A1A0A]'
      : 'text-[#847E70] hover:bg-[#EFE8D7] hover:text-[#1A1A0A] dark:text-[#A0A090] dark:hover:bg-[#182214] dark:hover:text-[#F0EDD4]',
  ].join(' ');

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_32%),linear-gradient(180deg,#0C1209_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-5 overflow-y-auto scrollbar-none px-3 py-4 sm:px-4 lg:px-6 lg:py-6">

        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#C49A1E]/18 bg-[#C49A1E]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:border-[#C49A1E]/25 dark:bg-[#C49A1E]/12 dark:text-[#F0D98C]">
                {t('badge_audit')}
              </span>
              <h1 className="mt-4 text-[clamp(28px,3vw,42px)] font-black leading-[1.04] text-[#1A1A0A] dark:text-[#F0EDD4]">
                {t('page_title')}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#6F6B5F] dark:text-[#A6A091]">
                {t('page_subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:w-[640px] 2xl:w-[720px]">
              {metrics.map((metric) => (
                <div key={metric.label} className="group relative overflow-hidden rounded-[24px] border border-[#E9E4D8] bg-[#FBFAF7] px-5 py-4 shadow-[0_10px_30px_rgba(26,26,10,0.05)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-[#1E2E18] dark:bg-[#0C150B]">
                  <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: metric.accent }} />
                  <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-3xl opacity-15 transition-opacity duration-200 group-hover:opacity-25" style={{ background: metric.accent }} />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{metric.label}</div>
                    <div className="mt-3 text-[28px] font-black leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">{metric.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter pills */}
          <div className="mt-5 rounded-[24px] border border-[#E7E1D5] bg-[#F8F6F1]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur dark:border-[#1E2E18] dark:bg-[#0C150B]/85">
            <div className="flex overflow-x-auto scrollbar-none">
              <div className="inline-flex flex-wrap gap-1.5 rounded-[18px] bg-white/65 p-1.5 dark:bg-[#111A0E]/80">
                <button type="button" onClick={() => handleActionFilter(null)} className={filterPill(actionFilter === null)}>
                  {t('filter_all_actions')}
                </button>
                {ALL_ACTIONS.map((a) => (
                  <button key={a} type="button" onClick={() => handleActionFilter(a)} className={filterPill(actionFilter === a)}>
                    {t(`action_${a}` as Parameters<typeof t>[0])}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EDE6] dark:bg-[#1A2A14]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#AAAAAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <p className="text-[14px] font-semibold text-[#9B9588] dark:text-[#7E8A75]">
                {actionFilter ? t('empty_filtered') : t('empty')}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-[#E8E3D7] bg-white shadow-[0_4px_12px_rgba(26,26,10,0.04)] dark:border-[#1E2E18] dark:bg-[#0E170C]">
              <div className="divide-y divide-[#EFEBE0] dark:divide-[#1A2A14]">
                {items.map((entry) => (
                  <LogRow key={entry.id} entry={entry} t={t} />
                ))}
              </div>
            </div>
          )}

          {meta && (
            <AdminPagination
              page={page}
              totalPages={meta.total_pages}
              total={meta.total}
              perPage={PER_PAGE}
              onPageChange={(p) => fetchPage(p, actionFilter)}
              loading={loading}
            />
          )}
        </section>
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
  const tDetails = { show: t('details_show'), hide: t('details_hide') };

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
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#CCCCBB]" />
            {entry.admin_name}
          </span>
        </div>
        {entry.details && Object.keys(entry.details).length > 0 && (
          <DetailExpander action={entry.action} details={entry.details} tDetails={tDetails} />
        )}
      </div>

      {/* Desktop: 4-column grid */}
      <div className="hidden sm:grid sm:grid-cols-[2fr_1.5fr_1.5fr_1fr] sm:items-start sm:gap-4">
        {/* Action */}
        <div className="flex flex-col gap-1.5">
          <ActionBadge action={entry.action} label={actionLabel} />
          {entry.details && Object.keys(entry.details).length > 0 && (
            <DetailExpander action={entry.action} details={entry.details} tDetails={tDetails} />
          )}
        </div>

        {/* Target */}
        <div className="flex flex-col gap-0.5 pt-0.5">
          {targetLabel
            ? <span className="text-[13px] font-semibold text-[#3A3A2A] dark:text-[#D0CDB8]">{targetLabel}</span>
            : <span className="text-[12px] text-[#AAAAAA]">—</span>}
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
