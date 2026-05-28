'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi } from '@/services';
import { AdminAddStationAccount, type StationAccountData, type StationAccountErrors } from './AdminAddStationAccount';
import { AdminAddStationInfo, type StationInfoData, type StationInfoErrors } from './AdminAddStationInfo';
import { AdminAddStationDocs, type StationDocsData, type StationDocsErrors } from './AdminAddStationDocs';
import { AdminAddStationSuccess, type StationSuccessData } from './AdminAddStationSuccess';
type Step = 1 | 2 | 3 | 'success';

interface Props {
  open:       boolean;
  onClose:    () => void;
  onCreated?: () => void;
}

const ACCOUNT_INIT: StationAccountData = { firstName: '', lastName: '', email: '', phone: '' };
const INFO_INIT: StationInfoData = {
  stationName: '', legalName: '', registrationNumber: '', address: '', city: '',
  washPostCount: '', washTypeCodes: [], serviceScope: '', description: '',
};
const DOCS_INIT: StationDocsData = { mode: 'later', certificate: null, addressProof: null, license: null };

export function AdminAddStationModal({ open, onClose, onCreated }: Props) {
  const t = useTranslations('admin_add_station');

  const [step,         setStep]         = useState<Step>(1);
  const [account,      setAccount]      = useState<StationAccountData>(ACCOUNT_INIT);
  const [info,         setInfo]         = useState<StationInfoData>(INFO_INIT);
  const [docs,         setDocs]         = useState<StationDocsData>(DOCS_INIT);
  const [accountErrs,  setAccountErrs]  = useState<StationAccountErrors>({});
  const [infoErrs,     setInfoErrs]     = useState<StationInfoErrors>({});
  const [docsErrs,     setDocsErrs]     = useState<StationDocsErrors>({});
  const [busy,         setBusy]         = useState(false);
  const [success,      setSuccess]      = useState<StationSuccessData | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1); setAccount(ACCOUNT_INIT); setInfo(INFO_INIT); setDocs(DOCS_INIT);
      setAccountErrs({}); setInfoErrs({}); setDocsErrs({}); setBusy(false); setSuccess(null);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [busy, onClose]);

  function validateAccount(): boolean {
    const errs: StationAccountErrors = {};
    if (!account.firstName.trim())               errs.firstName = t('error_firstname_required');
    else if (account.firstName.trim().length > 100) errs.firstName = t('error_firstname_too_long');
    if (!account.lastName.trim())                errs.lastName  = t('error_lastname_required');
    else if (account.lastName.trim().length > 100)  errs.lastName  = t('error_lastname_too_long');
    if (!account.email.trim())                   errs.email = t('error_email_required');
    else if (account.email.trim().length > 254)  errs.email = t('error_email_too_long');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim())) errs.email = t('error_email_invalid');
    setAccountErrs(errs);
    return Object.keys(errs).length === 0;
  }

  function validateInfo(): boolean {
    const errs: StationInfoErrors = {};
    if (!info.stationName.trim())               errs.stationName   = t('error_station_name_required');
    else if (info.stationName.trim().length < 2) errs.stationName  = t('error_station_name_too_short');
    if (!info.address.trim())                   errs.address       = t('error_address_required');
    else if (info.address.trim().length < 5)    errs.address       = t('error_address_too_short');
    if (!info.city.trim())                      errs.city          = t('error_city_required');
    const count = parseInt(info.washPostCount, 10);
    if (!info.washPostCount || isNaN(count) || count < 1 || count > 100) {
      errs.washPostCount = info.washPostCount ? t('error_wash_posts_invalid') : t('error_wash_posts_required');
    }
    if (info.washTypeCodes.length === 0) errs.washTypeCodes = t('error_wash_types_required');
    setInfoErrs(errs);
    return Object.keys(errs).length === 0;
  }

  function validateDocs(): boolean {
    if (docs.mode !== 'now') return true;
    const errs: StationDocsErrors = {};
    if (!docs.certificate)  errs.certificate  = t('doc_error_required');
    if (!docs.addressProof) errs.addressProof = t('doc_error_required');
    setDocsErrs(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validateDocs()) return;
    setBusy(true);
    try {
      const [ok, data] = await postWithApi('/admin/stations', {
        owner: {
          first_name: account.firstName.trim(),
          last_name:  account.lastName.trim(),
          email:      account.email.trim(),
          ...(account.phone.trim() ? { phone: account.phone.trim() } : {}),
        },
        station: {
          name:          info.stationName.trim(),
          ...(info.legalName.trim()  ? { legal_name:  info.legalName.trim()  } : {}),
          address:       info.address.trim(),
          city:          info.city.trim(),
          ...(info.serviceScope ? { service_scope: info.serviceScope } : {}),
          ...(info.description.trim() ? { description: info.description.trim() } : {}),
        },
      });
      if (ok) {
        const created = (data as { data: { user: { first_name: string; last_name: string; email: string } } }).data;
        setSuccess({
          email:      created.user.email,
          first_name: created.user.first_name,
          last_name:  created.user.last_name,
          docsMode:   docs.mode,
        });
        onCreated?.();
        setStep('success');
      } else {
        const errData = data as { code?: string; message?: string };
        if (errData?.code === 'EMAIL_ALREADY_EXISTS') {
          setStep(1);
          setAccountErrs({ email: t('error_email_conflict') });
        } else {
          setDocsErrs({ certificate: errData?.message ?? t('error_generic') });
        }
      }
    } catch {
      setDocsErrs({ certificate: t('error_generic') });
    } finally {
      setBusy(false);
    }
  }

  const STEP_LABELS: Record<1 | 2 | 3, string> = { 1: t('step_account'), 2: t('step_info'), 3: t('step_docs') };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />

      <div className="relative z-10 w-full max-w-[520px] animate-fade-in-up overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-2xl dark:border-[#1E2E18] dark:bg-[#0F1A0C]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <div>
            <h2 className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">
              {step === 'success' ? t('modal_success_title') : t('modal_title')}
            </h2>
            {step !== 'success' && (
              <div className="mt-1.5 flex items-center gap-1.5">
                {([1, 2, 3] as const).map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={[
                      'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black',
                      step === s ? 'bg-[#DDAF3B] text-[#0C1209]' : (step as number) > s ? 'bg-[#00C851]/20 text-[#00C851]' : 'bg-[#F0EDE6] text-[#999] dark:bg-[#1A2A14] dark:text-[#A0A090]',
                    ].join(' ')}>{(step as number) > s ? '✓' : s}</div>
                    <span className={`text-[11px] font-semibold ${step === s ? 'text-[#001201] dark:text-[#FFF9EC]' : 'text-[#999] dark:text-[#A0A090]'}`}>{STEP_LABELS[s]}</span>
                    {s < 3 && <div className="h-px w-3 bg-[#E0DCD0] dark:bg-[#1A2A14]" />}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('btn_close')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#BBBBAA] transition-colors hover:bg-[#F0EDE6] hover:text-foreground/70 disabled:opacity-40 dark:hover:bg-[#1A2A14]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {step === 1 && (
          <AdminAddStationAccount data={account} errors={accountErrs} busy={busy}
            onChange={setAccount} onNext={() => { if (validateAccount()) setStep(2); }} onClose={onClose} />
        )}
        {step === 2 && (
          <AdminAddStationInfo data={info} errors={infoErrs} busy={busy}
            onChange={setInfo} onErrors={setInfoErrs}
            onNext={() => { if (validateInfo()) setStep(3); }} onPrev={() => setStep(1)} />
        )}
        {step === 3 && (
          <AdminAddStationDocs data={docs} errors={docsErrs} busy={busy}
            onChange={setDocs} onErrors={setDocsErrs} onSubmit={handleSubmit} onPrev={() => setStep(2)} />
        )}
        {step === 'success' && success && <AdminAddStationSuccess data={success} onClose={onClose} />}
      </div>
    </div>
  );
}
