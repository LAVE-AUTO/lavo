'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { useToast } from '@/context';

const MAX_REASON = 500;

interface ApiDocument { id: string; document_type: string; file_url: string; }
interface ApiStation {
  id: string; name: string; legal_name: string | null; registration_number: string | null;
  address: string; city: string; description: string | null;
  service_scope: string | null; wash_post_count: number | null;
  status: string; created_at: string; documents: ApiDocument[];
}

interface Props { id: string }

export function AdminStationDetail({ id }: Props) {
  const t      = useTranslations('admin_stations');
  const router = useRouter();
  const { success, error: showError } = useToast();

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [station, setStation]   = useState<ApiStation | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [approving, setApproving]     = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [showReject, setShowReject]   = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting]     = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadStation = useCallback(async () => {
    setLoading(true); setLoadError(false);
    const [ok, data] = await getFromApi(`/admin/stations/${id}`);
    if (!mountedRef.current) return;
    if (!ok) { setLoadError(true); setLoading(false); return; }
    setStation((data as { data: ApiStation }).data);
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

  const handleReject = async () => {
    if (!station || !rejectReason.trim()) return;
    setRejecting(true); setActionError(null);
    const [ok] = await postWithApi(`/admin/stations/${id}/reject`, { rejection_reason: rejectReason.trim() });
    if (!mountedRef.current) return;
    setRejecting(false);
    if (ok) { success(t('action_success_reject')); router.push('/admin/stations'); }
    else { showError(t('action_error')); setActionError(t('action_error')); }
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
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
    </div>
  );

  /* ── Error ── */
  if (loadError || !station) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#F5F5EE] dark:bg-[#0C1209]">
      <p className="text-[14px] font-semibold text-[#555] dark:text-[#B0B0A0]">{t('error_load')}</p>
      <button type="button" onClick={loadStation}
        className="rounded-xl border border-[#C49A1E]/50 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] hover:bg-[#C49A1E]/10">
        {t('btn_retry')}
      </button>
    </div>
  );

  const isPending = station.status === 'pending_admin_validation';

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#F5F5EE] dark:bg-[#0C1209]">

      {/* ── Sticky sub-header ── */}
      <div className="flex items-center gap-4 border-b border-[#E8E4D8] bg-white px-7 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <Link href={'/admin/stations' as Parameters<typeof Link>[0]['href']}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0EDE0] text-[#888] transition-colors hover:bg-[#E8E4D8] dark:bg-[#1E2A1A] dark:text-[#6A6A5A]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-black text-[#0F1A0C] dark:text-[#F0EDD4]">{station.name}</h1>
          <p className="text-[11px] text-[#999] dark:text-[#5A5A4A]">{station.city}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#C49A1E]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#C49A1E]">
          KYC — {t('page_title')}
        </span>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-7 py-6">

        {/* Info card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.15em] text-[#C49A1E]">{t('detail_info')}</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
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

        {/* Documents card */}
        {station.documents.length > 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.15em] text-[#C49A1E]">{t('detail_docs')}</p>
            <div className="grid grid-cols-2 gap-3">
              {station.documents.map((doc) => (
                <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-[#E8E4D8] p-4 transition-all hover:border-[#C49A1E]/40 hover:shadow-sm dark:border-[#1E2A1A]">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C49A1E]/10">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-[#0F1A0C] dark:text-[#F0EDD4]">
                      {docLabel(doc.document_type)}
                    </p>
                    <p className="text-[10px] text-[#C49A1E] group-hover:underline">{t('doc_open')} →</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky action bar ── */}
      {isPending && (
        <div className="border-t border-[#E8E4D8] bg-white px-7 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
          {actionError && <p className="mb-3 text-[12px] font-semibold text-[#EF4444]">{actionError}</p>}

          {!showReject ? (
            <div className="flex gap-3">
              {!confirmApprove ? (
                <>
                  <button type="button" onClick={() => { setConfirmApprove(true); setActionError(null); }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00C851] py-3 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-[#00A841] hover:shadow">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {t('btn_approve')}
                  </button>
                  <button type="button" onClick={() => { setShowReject(true); setActionError(null); }}
                    className="flex flex-1 items-center justify-center rounded-xl border-2 border-[#EF4444]/40 py-3 text-[13px] font-bold text-[#EF4444] transition-colors hover:bg-[#EF4444]/5">
                    {t('btn_reject')}
                  </button>
                </>
              ) : (
                <div className="flex flex-1 items-center gap-3 rounded-xl border-2 border-[#00C851]/40 bg-[#00C851]/5 px-4 py-3">
                  <p className="flex-1 text-[13px] font-semibold text-[#0F1A0C] dark:text-[#F0EDD4]">{t('btn_approve')} ?</p>
                  <button type="button" onClick={() => setConfirmApprove(false)} disabled={approving}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#888] hover:bg-[#F0EDE0] dark:hover:bg-[#1E2A1A]">
                    {t('btn_cancel')}
                  </button>
                  <button type="button" onClick={handleApprove} disabled={approving}
                    className="flex items-center gap-2 rounded-xl bg-[#00C851] px-4 py-1.5 text-[12px] font-bold text-white disabled:opacity-60">
                    {approving && <Spinner />}
                    Confirmer
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="reject-reason" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#888] dark:text-[#6A6A5A]">
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
                  className="w-full resize-none rounded-xl border border-[#E8E4D8] bg-[#F8F6F2] px-4 py-3 text-[13px] text-[#0F1A0C] outline-none transition focus:border-[#EF4444]/50 focus:ring-2 focus:ring-[#EF4444]/10 disabled:opacity-50 dark:border-[#1E2A1A] dark:bg-[#0F1A0C] dark:text-[#F0EDD4]"
                />
                <div className="mt-1 flex justify-end text-[10px] text-[#CCC] dark:text-[#3A3A2A]">
                  {rejectReason.length}/{MAX_REASON}
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowReject(false); setRejectReason(''); setActionError(null); }}
                  disabled={rejecting}
                  className="flex-1 rounded-xl border border-[#E0DCD0] py-2.5 text-[13px] font-semibold text-[#666] hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]">
                  {t('btn_cancel')}
                </button>
                <button type="button" onClick={handleReject} disabled={rejecting || !rejectReason.trim()}
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

function InfoField({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#CCC] dark:text-[#3A3A2A]">{label}</p>
      <p className="text-[13px] font-medium text-[#0F1A0C] dark:text-[#F0EDD4]">{value}</p>
    </div>
  );
}

const Spinner = () => (
  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
);
