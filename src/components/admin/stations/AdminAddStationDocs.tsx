'use client';

import { useTranslations } from 'next-intl';
import { AdminDocUpload, type UploadedDoc } from './AdminDocUpload';

export type DocsMode = 'now' | 'later';

export interface StationDocsData {
  mode:        DocsMode;
  certificate: UploadedDoc | null;
  addressProof: UploadedDoc | null;
  license:     UploadedDoc | null;
}

export interface StationDocsErrors {
  certificate?:  string;
  addressProof?: string;
}

interface Props {
  data:     StationDocsData;
  errors:   StationDocsErrors;
  busy:     boolean;
  onChange: (data: StationDocsData) => void;
  onErrors: (errors: StationDocsErrors) => void;
  onSubmit: () => void;
  onPrev:   () => void;
}

function ModeCard({ selected, onClick, icon, label, sub }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={[
        'flex flex-1 flex-col gap-1 rounded-xl border-[1.5px] px-3 py-3 text-left transition-all duration-150',
        selected
          ? 'border-[#C49A1E] bg-[#C49A1E]/8 shadow-sm'
          : 'border-[#D8D4C8] bg-white hover:border-[#C49A1E]/50 dark:border-[#243020] dark:bg-[#0F1A0C]',
      ].join(' ')}>
      <span className={`mb-0.5 ${selected ? 'text-[#C49A1E]' : 'text-[#888] dark:text-[#6A6A5A]'}`}>{icon}</span>
      <span className={`text-[12px] font-bold ${selected ? 'text-[#1A1A0A] dark:text-[#F0EDD4]' : 'text-[#555] dark:text-[#9A9A8A]'}`}>{label}</span>
      <span className={`text-[10px] leading-snug ${selected ? 'text-[#C49A1E]/70' : 'text-[#999] dark:text-[#8A8A7A]'}`}>{sub}</span>
    </button>
  );
}

export function AdminAddStationDocs({ data, errors, busy, onChange, onErrors, onSubmit, onPrev }: Props) {
  const t = useTranslations('admin_add_station');

  return (
    <>
      <div className="flex flex-col gap-4 px-6 py-5">

        {/* Toggle */}
        <div className="flex gap-3">
          <ModeCard
            selected={data.mode === 'now'} onClick={() => { onChange({ ...data, mode: 'now' }); onErrors({}); }}
            label={t('docs_toggle_now')} sub={t('docs_toggle_now_sub')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
          />
          <ModeCard
            selected={data.mode === 'later'} onClick={() => { onChange({ ...data, mode: 'later' }); onErrors({}); }}
            label={t('docs_toggle_later')} sub={t('docs_toggle_later_sub')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
        </div>

        {data.mode === 'now' ? (
          <>
            <AdminDocUpload
              label={t('doc_certificate')} hint={t('doc_certificate_hint')} required
              value={data.certificate} error={errors.certificate}
              onChange={(f) => onChange({ ...data, certificate: f })} />
            <AdminDocUpload
              label={t('doc_address_proof')} hint={t('doc_address_proof_hint')} required
              value={data.addressProof} error={errors.addressProof}
              onChange={(f) => onChange({ ...data, addressProof: f })} />
            <AdminDocUpload
              label={t('doc_license')} hint={t('doc_license_hint')}
              value={data.license}
              onChange={(f) => onChange({ ...data, license: f })} />
          </>
        ) : (
          <div className="flex gap-2.5 rounded-xl border border-[#C49A1E]/20 bg-[#C49A1E]/6 px-4 py-3.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-[11px] leading-relaxed text-[#1A1A0A] dark:text-[#F0EDD4]">{t('docs_later_notice')}</p>
          </div>
        )}
      </div>

      {/* Preview notice — endpoint not yet available */}
      <div className="mx-6 mb-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 dark:border-orange-900/40 dark:bg-orange-950/20">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="text-[11px] leading-snug text-orange-700 dark:text-orange-400">{t('form_api_unavailable_notice')}</p>
      </div>

      <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
        <button type="button" onClick={onPrev} disabled={busy}
          className="rounded-lg border border-[#D8D4C8] px-4 py-2 text-[12px] font-semibold text-[#666] transition-colors hover:bg-[#F5F3EE] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]">
          {t('btn_prev')}
        </button>
        {/* Submit disabled — TODO: enable once POST /admin/stations endpoint is available */}
        <button type="button" onClick={onSubmit} disabled
          title={t('form_api_unavailable_notice')}
          className="rounded-lg bg-[#C49A1E] px-4 py-2 text-[12px] font-bold text-[#0C1209] opacity-40 cursor-not-allowed">
          {t('btn_create')}
        </button>
      </div>
    </>
  );
}
