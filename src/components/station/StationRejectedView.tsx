'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context';
import { postWithApi } from '@/services';
import { FileUploadZone, type UploadedFile } from '@/components/stations/apply/FileUploadZone';

interface Props {
  stationName: string;
  rejectionReason: string | null;
}

const inputClass =
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:focus:border-[#C49A1E] dark:focus:bg-[#182214]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{label}</label>
      {children}
    </div>
  );
}

export function StationRejectedView({ stationName, rejectionReason }: Props) {
  const t = useTranslations('station_rejected');
  const { logout } = useAuth();

  const [showForm, setShowForm]       = useState(false);
  const [name, setName]               = useState(stationName);
  const [address, setAddress]         = useState('');
  const [city, setCity]               = useState('');
  const [description, setDesc]        = useState('');
  const [certificate, setCertificate] = useState<UploadedFile | null>(null);
  const [addressProof, setAddressProof] = useState<UploadedFile | null>(null);
  const [license, setLicense]         = useState<UploadedFile | null>(null);
  const [docErrors, setDocErrors]     = useState({ certificate: '', addressProof: '' });
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [countdown, setCountdown]     = useState(5);
  const [error, setError]             = useState<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Auto-reload 5s after successful resubmit
  useEffect(() => {
    if (!submitted) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted]);

  function validateDocs(): boolean {
    const errors = { certificate: '', addressProof: '' };
    if (!certificate) errors.certificate = t('doc_required');
    if (!addressProof) errors.addressProof = t('doc_required');
    setDocErrors(errors);
    return !errors.certificate && !errors.addressProof;
  }

  async function handleReapply(e: React.FormEvent) {
    e.preventDefault();
    if (!validateDocs()) return;

    setSubmitting(true);
    setError(null);

    const documents = [
      { document_type: 'registration_certificate', file_url: certificate!.url, storage: certificate!.storage },
      { document_type: 'address_proof', file_url: addressProof!.url, storage: addressProof!.storage },
      ...(license ? [{ document_type: 'license', file_url: license.url, storage: license.storage }] : []),
    ];

    const [ok, data] = await postWithApi('/station/reapply', {
      name: name.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      description: description.trim() || undefined,
      documents,
    });

    if (!mountedRef.current) return;
    setSubmitting(false);
    if (ok) {
      setSubmitted(true);
    } else {
      const msg = (data as { message?: string })?.message;
      setError(msg ?? t('resubmit_error'));
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5EE] dark:bg-[#0C1209]">
      {/* Minimal top bar */}
      <div className="flex items-center justify-between border-b border-[#E0DCD0] bg-white px-6 py-3.5 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <span className="text-[14px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">Slowtime</span>
        <button type="button" onClick={logout}
          className="flex items-center gap-1.5 rounded-[8px] border border-[#E0DCD0] px-3 py-1.5 text-[12px] font-semibold text-[#888] transition-colors hover:bg-[#F0EDE0] dark:border-[#243020] dark:text-[#6A6A5A]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t('btn_logout')}
        </button>
      </div>

      <div className="flex flex-1 items-start justify-center p-6">
        <div className="w-full max-w-xl">

          {submitted ? (
            /* Success state */
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00C851]/10">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-[20px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('resubmit_success_title')}</h2>
              <p className="mt-2 text-[14px] text-[#666] dark:text-[#8A8A7A]">{t('resubmit_success_desc')}</p>
              <p className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-[#C49A1E]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#C49A1E] border-t-transparent" />
                {t('resubmit_redirect', { n: countdown })}
              </p>
            </div>
          ) : (
            <>
              {/* Rejection card */}
              <div className="mb-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EF4444]/10">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h1 className="text-[20px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('title')}</h1>
                <p className="mt-1.5 text-[13px] text-[#666] dark:text-[#8A8A7A]">{t('subtitle', { name: stationName })}</p>

                {rejectionReason && (
                  <div className="mt-5 rounded-[10px] border border-[#EF4444]/20 bg-[#FEF2F2] p-4 dark:border-[#3A1A1A] dark:bg-[#200D0D]">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-[#EF4444]/70">{t('reason_label')}</p>
                    <p className="text-[13px] leading-relaxed text-[#333] dark:text-[#E0B0B0]">{rejectionReason}</p>
                  </div>
                )}
              </div>

              {/* Resubmit form */}
              {!showForm ? (
                <div className="flex flex-col gap-3">
                  <button type="button" onClick={() => setShowForm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C49A1E] py-3.5 text-[14px] font-bold text-[#0C1209] shadow-sm transition-opacity hover:opacity-80">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    {t('btn_resubmit')}
                  </button>
                  <p className="text-center text-[11px] text-[#AAAAAA] dark:text-[#5A5A4A]">{t('or_contact_support')}</p>
                </div>
              ) : (
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
                  <h2 className="mb-5 text-[15px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('form_title')}</h2>
                  <form onSubmit={handleReapply} className="flex flex-col gap-4">

                    {/* Text fields */}
                    <Field label={t('field_name')}>
                      <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)}
                        maxLength={150} placeholder={t('field_name_placeholder')} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label={t('field_address')}>
                        <input type="text" className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)}
                          maxLength={200} placeholder={t('field_address_placeholder')} />
                      </Field>
                      <Field label={t('field_city')}>
                        <input type="text" className={inputClass} value={city} onChange={(e) => setCity(e.target.value)}
                          maxLength={100} placeholder={t('field_city_placeholder')} />
                      </Field>
                    </div>
                    <Field label={t('field_description')}>
                      <textarea rows={3} className={inputClass + ' resize-none leading-relaxed'} value={description}
                        onChange={(e) => setDesc(e.target.value)} maxLength={1000} placeholder={t('field_description_placeholder')} />
                    </Field>

                    {/* Document uploads */}
                    <div className="mt-1 border-t border-[#E8E4D8] pt-5 dark:border-[#243020]">
                      <p className="mb-4 text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('docs_section_title')}</p>
                      <FileUploadZone
                        label={t('doc_certificate')}
                        hint={t('doc_certificate_hint')}
                        required
                        value={certificate}
                        onChange={(f) => { setCertificate(f); if (f) setDocErrors((prev) => ({ ...prev, certificate: '' })); }}
                        error={docErrors.certificate}
                      />
                      <FileUploadZone
                        label={t('doc_address_proof')}
                        hint={t('doc_address_proof_hint')}
                        required
                        value={addressProof}
                        onChange={(f) => { setAddressProof(f); if (f) setDocErrors((prev) => ({ ...prev, addressProof: '' })); }}
                        error={docErrors.addressProof}
                      />
                      <FileUploadZone
                        label={t('doc_license')}
                        hint={t('doc_license_hint')}
                        value={license}
                        onChange={setLicense}
                      />
                    </div>

                    {error && <p className="text-[12px] font-semibold text-[#EF4444]">{error}</p>}

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => setShowForm(false)} disabled={submitting}
                        className="flex-1 rounded-[10px] border border-[#E0DCD0] py-2.5 text-[13px] font-semibold text-[#666] hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]">
                        {t('btn_cancel')}
                      </button>
                      <button type="submit" disabled={submitting}
                        className="flex flex-1 items-center justify-center rounded-[10px] bg-[#C49A1E] py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50">
                        {submitting ? t('btn_submitting') : t('btn_confirm_resubmit')}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
