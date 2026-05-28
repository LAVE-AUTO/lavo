'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getFromApi } from '@/services';
import { useToast } from '@/context/toast-context';
import { AdminEditUserModal } from './AdminEditUserModal';
import { AdminDeleteUserModal } from './AdminDeleteUserModal';
import { useRouter } from 'next/navigation';

interface ClientDetail {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  role: string;
  created_at: string;
  updated_at?: string;
}

interface EditableUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string;
}

const STATUS_STYLE: Record<string, { dot: string; text: string; bg: string }> = {
  active:               { dot: 'bg-[#22C55E]', text: 'text-[#166534] dark:text-[#86EFAC]', bg: 'bg-[#F0FDF4] dark:bg-[#0A2A14]' },
  suspended:            { dot: 'bg-[#F97316]', text: 'text-[#9A3412] dark:text-[#FDBA74]', bg: 'bg-[#FFF7ED] dark:bg-[#2A1200]' },
  blocked:              { dot: 'bg-[#F43F5E]', text: 'text-[#9F1239] dark:text-[#FDA4AF]', bg: 'bg-[#FFF1F2] dark:bg-[#2A0A12]' },
  pending_verification: { dot: 'bg-[#C49A1E]', text: 'text-[#7A5E0A] dark:text-[#F0D98C]', bg: 'bg-[#FEFCE8] dark:bg-[#1A1500]' },
};

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

interface Props {
  id: string;
}

/**
 * Admin client detail view — fetches user by ID, shows profile info,
 * and provides edit and delete actions via modals.
 */
export function AdminClientDetail({ id }: Props) {
  const t = useTranslations('admin_client_detail');
  const tCommon = useTranslations('admin_clients');
  const router = useRouter();
  const { success: toastSuccess } = useToast();
  const mountedRef = useRef(true);

  const [client,    setClient]    = useState<ClientDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [fetchErr,  setFetchErr]  = useState(false);
  const [editOpen,  setEditOpen]  = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    getFromApi(`/admin/users/${id}`)
      .then(([ok, data]) => {
        if (!mountedRef.current) return;
        if (ok) {
          setClient((data as { data: ClientDetail }).data);
        } else {
          setFetchErr(true);
        }
      })
      .catch(() => { if (mountedRef.current) setFetchErr(true); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [id]);

  function handleSaved(updated: EditableUser) {
    setClient((prev) => (prev ? { ...prev, ...updated } : prev));
    toastSuccess(tCommon('action_success'));
  }

  function handleDeleted(_userId: string, permanent: boolean) {
    toastSuccess(tCommon('action_success'));
    if (permanent) {
      router.push('/admin/clients');
    } else {
      setClient((prev) => prev ? { ...prev, status: 'blocked' } : prev);
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C49A1E] border-t-transparent" />
    </div>
  );

  if (fetchErr || !client) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <p className="text-[13px] font-semibold text-red-500">{tCommon('error_load')}</p>
      <Link href={'/admin/clients' as Parameters<typeof Link>[0]['href']}
        className="text-[13px] font-semibold text-[#C49A1E] underline-offset-2 hover:underline">
        {t('back_to_list')}
      </Link>
    </div>
  );

  const statusStyle = STATUS_STYLE[client.status] ?? STATUS_STYLE.active;
  const displayName = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email;
  const initials    = `${client.first_name?.[0] ?? ''}${client.last_name?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_32%),linear-gradient(180deg,#0C1209_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-1 flex-col gap-5 overflow-y-auto scrollbar-none px-3 py-4 sm:px-4 lg:px-6 lg:py-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] text-foreground/55 dark:text-[#9A9A8A]">
          <Link href={'/admin/clients' as Parameters<typeof Link>[0]['href']}
            className="transition-colors hover:text-[#C49A1E]">
            {t('back_to_list')}
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{displayName}</span>
        </div>

        {/* Profile card */}
        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1A1A0A]/5 text-[16px] font-black text-[#1A1A0A] ring-1 ring-inset ring-[#1A1A0A]/8 dark:bg-[#F0EDD4]/8 dark:text-[#F0EDD4] dark:ring-[#F0EDD4]/10">
                {initials}
              </div>
              <div>
                <h1 className="text-[18px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{displayName}</h1>
                <p className="mt-0.5 text-[13px] text-foreground/55 dark:text-[#9A9A8A]">{client.email}</p>
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset ${statusStyle.bg} ${statusStyle.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                    {t(`status_${client.status}`) || client.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[14px] border border-[#E1DBCF] bg-white px-3 py-2 text-[13px] font-semibold text-[#5A554B] transition-colors hover:border-[#C49A1E]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#A6A091]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                {t('btn_edit')}
              </button>
              <button type="button" onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[14px] border border-red-200/60 bg-white px-3 py-2 text-[13px] font-semibold text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:bg-[#0E170C] dark:text-red-400 dark:hover:bg-red-950/30">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
                {t('btn_delete')}
              </button>
            </div>
          </div>
        </section>

        {/* Detail fields */}
        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_12px_40px_rgba(26,26,10,0.06)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90">
          <h2 className="mb-4 text-[14px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('section_info')}</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: t('field_id'),         value: client.id },
              { label: t('field_role'),        value: client.role },
              { label: t('field_phone'),       value: client.phone ?? '—' },
              { label: t('field_created_at'),  value: formatDate(client.created_at) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-[#F8F6F1] px-4 py-3 dark:bg-[#0C150B]">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{label}</p>
                <p className="mt-1 break-all text-[13px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{value}</p>
              </div>
            ))}
          </div>
        </section>

      </div>

      <AdminEditUserModal
        open={editOpen}
        user={client}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />
      <AdminDeleteUserModal
        open={deleteOpen}
        user={client}
        onClose={() => setDeleteOpen(false)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
