'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { useToast } from '@/context';

/* ------------------------------------------------------------------ */
/* API shapes                                                           */
/* ------------------------------------------------------------------ */

interface ApiDocument {
  id: string;
  document_type: string;
  file_url: string;
  storage: string;
}

interface ApiStation {
  id: string;
  name: string;
  legal_name: string | null;
  registration_number: string | null;
  address: string;
  city: string;
  description: string | null;
  service_scope: string | null;
  wash_post_count: number | null;
  status: string;
  created_at: string;
  documents: ApiDocument[];
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

interface Props { id: string }

export function AdminStationDetail({ id }: Props) {
  const t      = useTranslations('admin_stations');
  const router = useRouter();
  const { success, error: showError } = useToast();

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [station, setStation]     = useState<ApiStation | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);

  /* Action states */
  const [approving, setApproving]       = useState(false);
  const [showReject, setShowReject]     = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting]       = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);

  const loadStation = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [ok, data] = await getFromApi(`/admin/stations/${id}`);
    if (!mountedRef.current) return;
    if (!ok) { setLoadError(true); setLoading(false); return; }
    setStation((data as { data: ApiStation }).data);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadStation(); }, [loadStation]);

  const handleApprove = async () => {
    if (!station) return;
    setApproving(true);
    setActionError(null);
    const [ok] = await postWithApi(`/admin/stations/${id}/approve`, {});
    if (!mountedRef.current) return;
    setApproving(false);
    if (ok) {
      success(t('action_success_approve'));
      router.push('/admin/stations');
    } else {
      setActionError(t('action_error'));
    }
  };

  const handleReject = async () => {
    if (!station || !rejectReason.trim()) return;
    setRejecting(true);
    setActionError(null);
    const [ok] = await postWithApi(`/admin/stations/${id}/reject`, { rejection_reason: rejectReason.trim() });
    if (!mountedRef.current) return;
    setRejecting(false);
    if (ok) {
      success(t('action_success_reject'));
      router.push('/admin/stations');
    } else {
      setActionError(t('action_error'));
    }
  };

  /* Loading */
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
      </div>
    );
  }

  /* Error */
  if (loadError || !station) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <span className="text-[14px] font-semibold text-[#555] dark:text-[#B0B0A0]">{t('error_load')}</span>
        <button type="button" onClick={loadStation} className="rounded-[10px] border border-[#C49A1E]/50 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10">
          {t('btn_retry')}
        </button>
      </div>
    );
  }

  const scopeLabel: Record<string, string> = {
    exterior: t('scope_exterior'),
    interior: t('scope_interior'),
    both:     t('scope_both'),
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Back */}
      <Link
        href="/admin/stations"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#C49A1E] hover:opacity-75 transition-opacity"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        {t('btn_back')}
      </Link>

      {/* Station info card */}
      <div className="rounded-xl border border-[#E8E4DC] bg-white p-5 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <h2 className="mb-4 text-[15px] font-bold uppercase tracking-wider text-[#BBBBAA] dark:text-[#4A4A3A]">
          {t('detail_info')}
        </h2>

        <div className="space-y-3">
          <InfoRow label={t('label_name')} value={station.name} />
          {station.legal_name && <InfoRow label={t('label_legal_name')} value={station.legal_name} />}
          {station.registration_number && <InfoRow label={t('label_reg_number')} value={station.registration_number} />}
          <InfoRow label={t('label_address')} value={station.address} />
          <InfoRow label={t('label_city')} value={station.city} />
          {station.wash_post_count != null && (
            <InfoRow label={t('label_posts')} value={String(station.wash_post_count)} />
          )}
          {station.service_scope && (
            <InfoRow label={t('label_scope')} value={scopeLabel[station.service_scope] ?? station.service_scope} />
          )}
          {station.description && <InfoRow label={t('label_description')} value={station.description} />}
        </div>
      </div>

      {/* Documents */}
      {station.documents.length > 0 && (
        <div className="rounded-xl border border-[#E8E4DC] bg-white p-5 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
          <h2 className="mb-4 text-[15px] font-bold uppercase tracking-wider text-[#BBBBAA] dark:text-[#4A4A3A]">
            {t('detail_docs')}
          </h2>
          <div className="flex flex-col gap-2">
            {station.documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-[#E8E4DC] px-4 py-3 text-[13px] hover:border-[#C49A1E]/40 transition-colors dark:border-[#1A2A14]"
              >
                <span className="font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{doc.document_type}</span>
                <span className="flex items-center gap-1 text-[#C49A1E]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                  {t('doc_open')}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {station.status === 'pending_admin_validation' && (
        <div className="rounded-xl border border-[#E8E4DC] bg-white p-5 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
          {actionError && (
            <p className="mb-3 text-[12px] font-semibold text-[#EF4444]">{actionError}</p>
          )}

          {!showReject ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#00C851] px-4 py-3 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {approving && <Spinner />}
                {t('btn_approve')}
              </button>
              <button
                type="button"
                onClick={() => { setShowReject(true); setActionError(null); }}
                disabled={approving}
                className="flex flex-1 items-center justify-center rounded-[10px] border-2 border-[#EF4444]/40 px-4 py-3 text-[13px] font-bold text-[#EF4444] transition-colors hover:bg-[#EF4444]/5 disabled:opacity-50"
              >
                {t('btn_reject')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-[12px] font-semibold text-[#888] dark:text-[#6A6A5A]">
                {t('reject_reason_label')}
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('reject_reason_placeholder')}
                rows={3}
                className="w-full rounded-lg border border-[#E8E4DC] bg-[#F7F6F2] px-3 py-2 text-[13px] text-[#1A1A0A] outline-none focus:border-[#C49A1E] dark:border-[#1A2A14] dark:bg-[#0F1A0C] dark:text-[#F0EDD4]"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowReject(false); setRejectReason(''); setActionError(null); }}
                  disabled={rejecting}
                  className="flex-1 rounded-[10px] border border-[#D8D4C8] px-4 py-2.5 text-[13px] font-semibold text-[#5A5A4A] transition-colors hover:bg-[#F0EDE4] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={rejecting || !rejectReason.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#EF4444] px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
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

/* ---- helpers ---- */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-36 shrink-0 text-[12px] font-semibold text-[#BBBBAA] dark:text-[#4A4A3A]">{label}</span>
      <span className="text-[13px] text-[#1A1A0A] dark:text-[#F0EDD4]">{value}</span>
    </div>
  );
}

const Spinner = () => (
  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
);
