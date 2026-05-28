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
          ? 'border-[#DDAF3B] bg-[#DDAF3B]/8 shadow-sm'
          : 'border-[#D8D4C8] bg-white hover:border-[#DDAF3B]/50 dark:border-[#001A05] dark:bg-[#001201]',
      ].join(' ')}>
      <span className={`mb-0.5 ${selected ? 'text-[#DDAF3B]' : 'text-foreground/55 dark:text-[#9A9A8A]'}`}>{icon}</span>
      <span className={`text-[13px] font-bold ${selected ? 'text-[#001201] dark:text-[#FFF9EC]' : 'text-foreground/70 dark:text-[#9A9A8A]'}`}>{label}</span>
      <span className={`text-[11px] leading-snug ${selected ? 'text-[#DDAF3B]/70' : 'text-[#999] dark:text-[#A0A090]'}`}>{sub}</span>
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
          <div className="flex gap-2.5 rounded-xl border border-[#DDAF3B]/20 bg-[#DDAF3B]/6 px-4 py-3.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-[12px] leading-relaxed text-[#001201] dark:text-[#FFF9EC]">{t('docs_later_notice')}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
        <button type="button" onClick={onPrev} disabled={busy}
          className="rounded-lg border border-[#D8D4C8] px-4 py-2 text-[13px] font-semibold text-foreground/65 transition-colors hover:bg-[#F5F3EE] disabled:opacity-50 dark:border-[#001A05] dark:text-[#9A9A8A]">
          {t('btn_prev')}
        </button>
        <button type="button" onClick={onSubmit} disabled={busy}
          className="rounded-lg bg-[#DDAF3B] px-4 py-2 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14] disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? t('btn_creating') : t('btn_create')}
        </button>
      </div>
    </>
  );
}
