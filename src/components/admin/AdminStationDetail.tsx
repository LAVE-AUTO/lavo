'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { getFromApi, patchWithApi, postWithApi } from '@/services/axios-service';
import { useAuth, useToast } from '@/context';
import { AdminPromoQr } from './stations/AdminPromoQr';

const MAX_REASON = 500;
/** Expiry warning threshold (days) - show orange badge when expiry is within this window. */
const EXPIRY_WARNING_DAYS = 30;

type ExpiryStatus = 'none' | 'valid' | 'warning' | 'expired';

// Comparison is intentionally performed in UTC (YYYY-MM-DDT00:00:00Z) so
// two admins in different timezones see the same status for a given date.
// Trade-off: a date marked "today" turns expired at 00:00 UTC, which may
// feel early for admins west of UTC - acceptable for internal tooling.
function computeExpiryStatus(iso: string | null): ExpiryStatus {
  if (!iso) return 'none';
  const expiry = parseExpiryDate(iso)?.getTime() ?? Number.NaN;
  if (Number.isNaN(expiry)) return 'none';
  const now = Date.now();
  if (expiry < now) return 'expired';
  const diffDays = (expiry - now) / 86_400_000;
  return diffDays <= EXPIRY_WARNING_DAYS ? 'warning' : 'valid';
}

function parseExpiryDate(value: string | null): Date | null {
  if (!value) return null;

  const normalized = value.includes('T') ? value : `${value}T00:00:00Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

interface ApiDocument { id: string; document_type: string; file_url: string; expiry_date?: string | null; }
interface ApiStation {
  id: string; name: string; legal_name: string | null; registration_number: string | null;
  address: string; city: string; description: string | null;
  service_scope: string | null; wash_post_count: number | null;
  promo_commission_rate?: string | null;
  promo_ref_code?: string | null;
  status: string; created_at: string; updated_at: string;
  approved_at?: string | null; rejection_reason?: string | null;
  documents: ApiDocument[];
}

interface Props { id: string }

function getFileExtension(fileUrl: string): string {
  try {
    const pathname = new URL(fileUrl).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() ?? '';
  } catch {
    return '';
  }
}

function isPreviewableImage(fileUrl: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'].includes(getFileExtension(fileUrl));
}

export function AdminStationDetail({ id }: Props) {
  const t      = useTranslations('admin_stations');
  const locale = useLocale();
  const router = useRouter();
  const { success, error: showError } = useToast();

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [station, setStation]           = useState<ApiStation | null>(null);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [expiries, setExpiries]         = useState<Record<string, string | null>>({});
  const [approving, setApproving]       = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [showReject, setShowReject]     = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting]       = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);

  const loadStation = useCallback(async () => {
    setLoading(true); setLoadError(false);
    const [ok, data] = await getFromApi(`/admin/stations/${id}`);
    if (!mountedRef.current) return;
    if (!ok) { setLoadError(true); setLoading(false); return; }
    const nextStation = (data as { data: ApiStation }).data;
    setStation(nextStation);
    setExpiries(
      nextStation.documents.reduce<Record<string, string | null>>((acc, document) => {
        acc[document.id] = document.expiry_date ?? null;
        return acc;
      }, {})
    );
    setLoading(false);
  }, [id]);

  useEffect(() => { loadStation(); }, [loadStation]);

  const handleApprove = async () => {
    if (!station) return;
    setApproving(true); setActionError(null);
    const [ok] = await postWithApi(`/admin/stations/${id}/approve`, {});
    if (!mountedRef.current) return;
    setApproving(false);
    if (ok) { success(t('action_success_approve')); router.push('/admin/stations'); }
    else { setActionError(t('action_error')); setConfirmApprove(false); }
  };

  const MIN_REASON = 10;

  const handleReject = async () => {
    if (!station) return;
    const trimmed = rejectReason.trim();
    if (trimmed.length < MIN_REASON) {
      setActionError(t('reject_reason_min', { n: MIN_REASON }));
      return;
    }
    setRejecting(true); setActionError(null);
    const [ok, data] = await postWithApi(`/admin/stations/${id}/reject`, { rejection_reason: trimmed });
    if (!mountedRef.current) return;
    setRejecting(false);
    if (ok) {
      success(t('action_success_reject'));
      router.push('/admin/stations');
    } else {
      const apiMsg = (data as { message?: string })?.message;
      const msg = apiMsg ?? t('action_error');
      showError(msg);
      setActionError(msg);
    }
  };

  const scopeLabel: Record<string, string> = {
    exterior: t('scope_exterior'), interior: t('scope_interior'), both: t('scope_both'),
  };
  const docLabel = (type: string): string => {
    const known: Record<string, string> = {
      identity_document:     t('doc_identity_document'),
      business_registration: t('doc_business_registration'),
      proof_of_address:      t('doc_proof_of_address'),
      insurance_certificate: t('doc_insurance_certificate'),
      kbis:                  t('doc_kbis'),
      terms_acceptance:      t('doc_terms_acceptance'),
    };
    return known[type] ?? type.replace(/_/g, ' ');
  };

  /* ── Loading ── */
  if (loading) return (
    <div className="flex flex-1 items-center justify-center bg-[#F5F5EE] dark:bg-[#0C1209]">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
    </div>
  );

  /* ── Error ── */
  if (loadError || !station) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#F5F5EE] dark:bg-[#0C1209]">
      <p className="text-[14px] font-semibold text-foreground/70">{t('error_load')}</p>
      <button type="button" onClick={loadStation}
        className="rounded-xl border border-[#DDAF3B]/50 px-4 py-2 text-[13px] font-semibold text-[#DDAF3B] hover:bg-[#DDAF3B]/10">
        {t('btn_retry')}
      </button>
    </div>
  );

  const isPending    = station.status === 'pending_admin_validation';
  const stationInit  = station.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const formattedDate = new Date(station.created_at).toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { day: 'numeric', month: 'long', year: 'numeric' },
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#F5F5EE] dark:bg-[#0C1209]">

      {/* ── Sticky sub-header ── */}
      <div className="flex items-center gap-4 border-b border-[#E8E4D8] bg-white px-7 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <Link href={'/admin/stations' as Parameters<typeof Link>[0]['href']}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0EDE0] text-foreground/55 transition-colors hover:bg-[#E8E4D8] dark:bg-[#001A05] dark:text-[#9A9A8A]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate pb-0.5 text-[16px] font-black text-[#001201] dark:text-[#FFF9EC]">{station.name}</h1>
          <p className="text-[12px] text-[#999] dark:text-[#A0A090]">{station.city}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#DDAF3B]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#DDAF3B]">
          KYC
        </span>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-7 py-6">

        {/* ── Hero card ── */}
        <div className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#001A05] dark:ring-white/[0.06]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-[#DDAF3B]/6 to-transparent dark:from-[#DDAF3B]/4" />
          </div>
          <div className="flex items-start gap-5">
            {/* Large avatar */}
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#DDAF3B]/25 to-[#DDAF3B]/10 text-[22px] font-black text-[#DDAF3B] ring-2 ring-[#DDAF3B]/15">
              {stationInit}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[19px] font-black text-[#001201] dark:text-[#FFF9EC]">{station.name}</h2>
              <p className="mt-0.5 text-[13px] text-foreground/55 dark:text-[#9A9A8A]">
                {station.city}{station.address ? ` · ${station.address}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/* Date badge */}
                <span className="flex items-center gap-1.5 rounded-lg bg-[#F5F3ED] px-2.5 py-1 text-[12px] font-semibold text-[#777] dark:bg-[#001A05] dark:text-[#9A9A8A]">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {t('label_submitted_on')} {formattedDate}
                </span>
                {/* Doc count badge */}
                {station.documents.length > 0 && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-[#F5F3ED] px-2.5 py-1 text-[12px] font-semibold text-[#777] dark:bg-[#001A05] dark:text-[#9A9A8A]">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    {station.documents.length}
                  </span>
                )}
                {/* KYC status badge */}
                <span className="flex items-center gap-1.5 rounded-lg bg-[#DDAF3B]/10 px-2.5 py-1 text-[12px] font-black uppercase tracking-wider text-[#DDAF3B]">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DDAF3B] opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#DDAF3B]" />
                  </span>
                  KYC
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Info card ── */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#001A05] dark:ring-white/[0.06]">
          <p className="mb-5 text-[11px] font-black uppercase tracking-[0.15em] text-[#DDAF3B]">{t('detail_info')}</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <InfoField label={t('label_name')}       value={station.name} />
            {station.legal_name          && <InfoField label={t('label_legal_name')} value={station.legal_name} />}
            {station.registration_number && <InfoField label={t('label_reg_number')} value={station.registration_number} />}
            <InfoField label={t('label_city')}       value={station.city} />
            <InfoField label={t('label_address')}    value={station.address} />
            {station.wash_post_count != null && <InfoField label={t('label_posts')} value={String(station.wash_post_count)} />}
            {station.service_scope && <InfoField label={t('label_scope')} value={scopeLabel[station.service_scope] ?? station.service_scope} />}
            {station.description && <InfoField label={t('label_description')} value={station.description} full />}
          </div>
        </div>

        {/* ── Documents card ── */}
        {station.documents.length > 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#001A05] dark:ring-white/[0.06]">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.15em] text-[#DDAF3B]">{t('detail_docs')}</p>
            <p className="mb-4 rounded-lg border border-[#DDAF3B]/30 bg-[#DDAF3B]/10 px-3 py-2 text-[11px] leading-relaxed text-[#7A5A00] dark:text-[#E0C060]">
              {t('expiry_unsaved_notice')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {station.documents.map((doc) => (
                <DocCard
                  key={doc.id}
                  stationId={station.id}
                  doc={doc}
                  label={docLabel(doc.document_type)}
                  openLabel={t('doc_open')}
                  expiry={expiries[doc.id] ?? null}
                  onSaveExpiry={async (value) => {
                    const [ok, data] = await patchWithApi(`/admin/stations/${station.id}/documents/${doc.id}`, {
                      expiry_date: value,
                    });

                    if (!ok) {
                      const message = (data as { message?: string })?.message ?? t('action_error');
                      showError(message);
                      throw new Error(message);
                    }

                    const updated = data as { data?: { expiry_date?: string | null } };
                    const nextValue = updated.data?.expiry_date ?? value;
                    setExpiries((prev) => ({ ...prev, [doc.id]: nextValue }));
                    success(nextValue ? t('expiry_saved') : t('expiry_removed'));
                  }}
                  labels={{
                    set: t('expiry_set'),
                    edit: t('expiry_edit'),
                    save: t('expiry_save'),
                    cancel: t('btn_cancel'),
                    clear: t('expiry_clear'),
                    noExpiry: t('expiry_none'),
                    valid: t('expiry_badge_valid'),
                    warning: t('expiry_badge_warning'),
                    expired: t('expiry_badge_expired'),
                    fieldLabel: t('expiry_field_label'),
                  }}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        )}
        {/* ── QR Promotionnel (stations actives uniquement) ── */}
        {station.status === 'active' && (
          <AdminPromoQr
            stationId={station.id}
            stationName={station.name}
            initialPromoCommissionRate={station.promo_commission_rate ?? null}
            initialPromoRefCode={station.promo_ref_code ?? null}
          />
        )}

        {/* ── History timeline ── */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#001A05] dark:ring-white/[0.06]">
          <p className="mb-5 text-[11px] font-black uppercase tracking-[0.15em] text-[#DDAF3B]">{t('detail_history')}</p>
          <div className="flex flex-col gap-0">
            <TimelineEvent
              icon="submit"
              label={t('history_submitted')}
              date={station.created_at}
              locale={locale}
            />
            {station.status === 'active' && (
              <TimelineEvent
                icon="check"
                label={t('history_approved')}
                date={station.approved_at ?? station.updated_at}
                locale={locale}
                color="green"
              />
            )}
            {station.status === 'rejected' && (
              <TimelineEvent
                icon="x"
                label={t('history_rejected')}
                date={station.updated_at}
                locale={locale}
                color="red"
                note={station.rejection_reason ?? undefined}
              />
            )}
            {station.status === 'pending_admin_validation' && (
              <TimelineEvent
                icon="clock"
                label={t('history_pending')}
                locale={locale}
                color="gold"
                active
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky action bar ── */}
      {isPending && (
        <div className="border-t border-[#E8E4D8] bg-white px-7 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
          {actionError && <p className="mb-3 text-[13px] font-semibold text-[#EF4444]">{actionError}</p>}

          {!showReject ? (
            <div className="flex gap-3">
              {!confirmApprove ? (
                <>
                  <button type="button" onClick={() => { setConfirmApprove(true); setActionError(null); }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00C851] py-3 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-[#00A841] hover:shadow">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                    {t('btn_approve')}
                  </button>
                  <button type="button" onClick={() => { setShowReject(true); setActionError(null); }}
                    className="flex flex-1 items-center justify-center rounded-xl border-2 border-[#EF4444]/40 py-3 text-[13px] font-bold text-[#EF4444] transition-colors hover:bg-[#EF4444]/5">
                    {t('btn_reject')}
                  </button>
                </>
              ) : (
                <div className="flex flex-1 items-center gap-3 rounded-xl border-2 border-[#00C851]/40 bg-[#00C851]/5 px-4 py-3">
                  <p className="flex-1 text-[13px] font-semibold text-[#001201] dark:text-[#FFF9EC]">{t('btn_approve')} ?</p>
                  <button type="button" onClick={() => setConfirmApprove(false)} disabled={approving}
                    className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-foreground/55 hover:bg-[#F0EDE0] dark:hover:bg-[#001A05]">
                    {t('btn_cancel')}
                  </button>
                  <button type="button" onClick={handleApprove} disabled={approving}
                    className="flex items-center gap-2 rounded-xl bg-[#00C851] px-4 py-1.5 text-[13px] font-bold text-white disabled:opacity-60">
                    {approving && <Spinner />}
                    {t('confirm_approve_label')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="reject-reason" className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#9A9A8A]">
                  {t('reject_reason_label')}
                </label>
                <textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value.slice(0, MAX_REASON))}
                  maxLength={MAX_REASON}
                  rows={3}
                  disabled={rejecting}
                  placeholder={t('reject_reason_placeholder')}
                  className="w-full resize-none rounded-xl border border-[#E8E4D8] bg-[#F8F6F2] px-4 py-3 text-[13px] text-[#001201] outline-none transition focus:border-[#EF4444]/50 focus:ring-2 focus:ring-[#EF4444]/10 disabled:opacity-50 dark:border-[#001A05] dark:bg-[#001201] dark:text-[#FFF9EC]"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className={`text-[11px] font-semibold transition-colors ${rejectReason.trim().length > 0 && rejectReason.trim().length < MIN_REASON ? 'text-[#EF4444]' : 'text-transparent'}`}>
                    {t('reject_reason_min', { n: MIN_REASON })}
                  </span>
                  <span className="text-[11px] text-[#CCC] dark:text-[#A0A090]">{rejectReason.length}/{MAX_REASON}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowReject(false); setRejectReason(''); setActionError(null); }}
                  disabled={rejecting}
                  className="flex-1 rounded-xl border border-[#E0DCD0] py-2.5 text-[13px] font-semibold text-foreground/65 hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#001A05] dark:text-[#9A9A8A]">
                  {t('btn_cancel')}
                </button>
                <button type="button" onClick={handleReject} disabled={rejecting || rejectReason.trim().length < MIN_REASON}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#EF4444] py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#DC2626] disabled:opacity-50">
                  {rejecting && <Spinner />}
                  {t('confirm_reject_label')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function InfoField({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-[#C8C4B4] dark:text-[#A0A090]">{label}</p>
      <p className="text-[13px] font-semibold text-[#001201] dark:text-[#FFF9EC]">{value}</p>
    </div>
  );
}

interface ExpiryLabels {
  set: string;
  edit: string;
  save: string;
  cancel: string;
  clear: string;
  noExpiry: string;
  valid: string;
  warning: string;
  expired: string;
  fieldLabel: string;
}

function DocCard({
  stationId, doc, label, openLabel, expiry, onSaveExpiry, labels, locale,
}: {
  stationId: string;
  doc: ApiDocument;
  label: string;
  openLabel: string;
  expiry: string | null;
  onSaveExpiry: (value: string | null) => Promise<void>;
  labels: ExpiryLabels;
  locale: string;
}) {
  const { token } = useAuth();
  const { error: showError } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(expiry ?? '');
  const inputId = `expiry-${doc.id}`;
  const status = computeExpiryStatus(expiry);

  const badgeStyle: Record<ExpiryStatus, { bg: string; text: string; label: string } | null> = {
    none:    null,
    valid:   { bg: 'bg-[#DCFCE7] dark:bg-[#0A2A14]', text: 'text-[#166534] dark:text-[#86EFAC]', label: labels.valid },
    warning: { bg: 'bg-[#FEF3C7] dark:bg-[#3A2800]', text: 'text-[#92400E] dark:text-[#FCD34D]', label: labels.warning },
    expired: { bg: 'bg-[#FEE2E2] dark:bg-[#2A0A0A]', text: 'text-[#991B1B] dark:text-[#FCA5A5]', label: labels.expired },
  };
  const badge = badgeStyle[status];
  const expiryDate = parseExpiryDate(expiry);
  const formattedExpiry = expiryDate
    ? expiryDate.toLocaleDateString(
        locale === 'en' ? 'en-CA' : 'fr-CA',
        { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
      )
    : null;

  const startEditing = () => {
    setDraft(expiry ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await onSaveExpiry(draft || null);
      setEditing(false);
    } catch {
      // Error already displayed by onSaveExpiry; editing stays open for retry.
    }
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleClear = async () => {
    setDraft('');
    try {
      await onSaveExpiry(null);
      setEditing(false);
    } catch {
      setDraft(expiry ?? '');
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E8E4D8] bg-[#FAFAF6] p-4 transition-all hover:border-[#DDAF3B]/40 hover:bg-white hover:shadow-sm dark:border-[#001A05] dark:bg-[#151E12] dark:hover:border-[#DDAF3B]/30 dark:hover:bg-[#001A05]">
      <div className="flex items-start justify-between gap-2">
        {/* Doc icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DDAF3B]/10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        </div>
        {badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        )}
      </div>

      <p className="text-[13px] font-bold leading-snug text-[#001201] dark:text-[#FFF9EC]">{label}</p>
      <p className="text-[11px] font-semibold text-foreground/55 dark:text-[#9A9A8A]">
        {formattedExpiry
          ? `Date d'expiration enregistrée : ${formattedExpiry}`
          : 'Aucune date d\'expiration enregistrée'}
      </p>

      {/* Expiry section */}
      <div className="flex flex-col gap-1.5">
        {!editing ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-foreground/55 dark:text-[#9A9A8A]">
              {formattedExpiry ?? labels.noExpiry}
            </span>
            <button
              type="button"
              onClick={startEditing}
              aria-label={expiry ? labels.edit : labels.set}
              className="rounded-lg border border-[#DDAF3B]/40 bg-[#DDAF3B]/10 px-2.5 py-1 text-[11px] font-bold text-[#9A7A10] transition-colors hover:bg-[#DDAF3B]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B] dark:border-[#DDAF3B]/30 dark:text-[#DDAF3B]"
            >
              {expiry ? labels.edit : labels.set}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-[11px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#9A9A8A]">
              {labels.fieldLabel}
            </label>
            <input
              id={inputId}
              type="date"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-lg border border-[#E8E4D8] bg-white px-3 py-1.5 text-[12px] text-[#001201] outline-none transition focus:border-[#DDAF3B]/50 focus:ring-2 focus:ring-[#DDAF3B]/10 dark:border-[#001A05] dark:bg-[#001201] dark:text-[#FFF9EC] [color-scheme:light] dark:[color-scheme:dark]"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleSave} disabled={!draft}
                className="flex-1 rounded-lg bg-[#DDAF3B] px-3 py-1.5 text-[11px] font-bold text-[#0C1209] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50">
                {labels.save}
              </button>
              <button type="button" onClick={handleCancel}
                className="rounded-lg border border-[#E0DCD0] px-3 py-1.5 text-[11px] font-semibold text-foreground/65 transition-colors hover:bg-[#F0EDE0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B] dark:border-[#001A05] dark:text-[#9A9A8A] dark:hover:bg-[#001A05]">
                {labels.cancel}
              </button>
              {expiry && (
                <button type="button" onClick={handleClear}
                  className="rounded-lg border border-[#EF4444]/40 px-3 py-1.5 text-[11px] font-semibold text-[#B2351F] transition-colors hover:bg-[#EF4444]/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444] dark:text-[#F0A090]">
                  {labels.clear}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Open link */}
      <button
        type="button"
        onClick={async () => {
          try {
            const directPreview = isPreviewableImage(doc.file_url);

            if (directPreview) {
              window.open(doc.file_url, '_blank', 'noopener');
              return;
            }

            if (!token) {
              showError('Session expirée, veuillez vous reconnecter.');
              return;
            }

            const response = await fetch(
              `/api/v1/admin/stations/${encodeURIComponent(stationId)}/documents/${encodeURIComponent(doc.id)}/download`,
              {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
              }
            );

            if (!response.ok) {
              showError('Impossible de télécharger le document.');
              return;
            }

            const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
            const blob = new Blob([await response.blob()], { type: contentType });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            const extension = getFileExtension(doc.file_url) || (
              contentType.includes('pdf') ? 'pdf' :
              contentType.includes('wordprocessingml') ? 'docx' :
              contentType.includes('msword') ? 'doc' :
              'bin'
            );
            anchor.download = `${stationId}-${doc.id}.${extension}`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
          } catch {
            showError('Unable to download document');
          }
        }}
        className="flex items-center gap-1 rounded text-[12px] font-semibold text-[#DDAF3B] transition-colors hover:text-[#B08A10] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B]"
      >
        {openLabel}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>
    </div>
  );
}

const Spinner = () => (
  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
);

type TimelineColor = 'gold' | 'green' | 'red' | 'grey';

function TimelineEvent({
  icon, label, date, locale, color = 'grey', note, active,
}: {
  icon: 'submit' | 'check' | 'x' | 'clock';
  label: string;
  date?: string | null;
  locale: string;
  color?: TimelineColor;
  note?: string;
  active?: boolean;
}) {
  const colorMap: Record<TimelineColor, { dot: string; text: string; bg: string }> = {
    gold:  { dot: '#DDAF3B', text: '#DDAF3B', bg: 'rgba(221, 175, 59,0.12)' },
    green: { dot: '#00C851', text: '#00C851', bg: 'rgba(0,200,81,0.10)' },
    red:   { dot: '#EF4444', text: '#EF4444', bg: 'rgba(239,68,68,0.10)' },
    grey:  { dot: '#AAAAAA', text: '#888',    bg: 'rgba(170,170,170,0.10)' },
  };
  const c = colorMap[color];

  const formattedDate = date
    ? new Date(date).toLocaleString(locale === 'en' ? 'en-CA' : 'fr-CA', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  const iconPath: Record<string, React.ReactNode> = {
    submit: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
    check:  <polyline points="20 6 9 17 4 12" />,
    x:      <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    clock:  <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  };

  return (
    <div className="group relative flex gap-4 pb-6 last:pb-0">
      {/* Connector line */}
      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-[#E8E4DC] group-last:hidden dark:bg-[#1A2A14]" />

      {/* Icon */}
      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: c.bg }}>
        {active && (
          <span className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ background: c.dot }} />
        )}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.dot} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {iconPath[icon]}
        </svg>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-0.5 pt-1">
        <p className="text-[13px] font-bold" style={{ color: c.text }}>{label}</p>
        {formattedDate && (
          <p className="text-[12px] text-[#999] dark:text-[#A0A090]">{formattedDate}</p>
        )}
        {note && (
          <div className="mt-2 rounded-[8px] border border-[#EF4444]/20 bg-[#FEF2F2] px-3 py-2 dark:border-[#3A1A1A] dark:bg-[#200D0D]">
            <p className="text-[13px] leading-relaxed text-foreground/70 dark:text-[#E0B0B0]">{note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
