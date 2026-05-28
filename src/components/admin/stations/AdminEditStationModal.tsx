'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { updateWithApi } from '@/services';

interface StationData {
  id: string;
  name: string;
  legal_name?: string | null;
  address: string;
  city: string;
  service_scope?: string | null;
  description?: string | null;
  status: string;
  is_open: boolean;
}

interface Props {
  open:    boolean;
  station: StationData | null;
  onClose: () => void;
  onSaved: (updated: StationData) => void;
}

const STATION_STATUS_VALUES = ['active', 'suspended', 'disabled'] as const;
const SERVICE_SCOPE_VALUES  = ['', 'exterior', 'interior', 'both'] as const;

const inputBase = 'w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#001201] outline-none transition-all dark:text-[#FFF9EC]';
const inputIdle = 'border-[#D8D4C8] focus:border-[#DDAF3B] focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.10)] dark:border-[#001A05] dark:focus:border-[#DDAF3B]';
const inputErr  = 'border-red-400 focus:border-red-400';

/**
 * Modal for editing an existing station's whitelisted fields.
 * PUTs /api/v1/admin/stations/:id on submit.
 */
export function AdminEditStationModal({ open, station, onClose, onSaved }: Props) {
  const t = useTranslations('admin_edit_station');

  const [name,         setName]         = useState('');
  const [legalName,    setLegalName]    = useState('');
  const [address,      setAddress]      = useState('');
  const [city,         setCity]         = useState('');
  const [serviceScope, setServiceScope] = useState('');
  const [description,  setDescription]  = useState('');
  const [status,       setStatus]       = useState('active');
  const [isOpen,       setIsOpen]       = useState(false);
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [busy,         setBusy]         = useState(false);

  useEffect(() => {
    if (open && station) {
      setName(station.name);
      setLegalName(station.legal_name ?? '');
      setAddress(station.address);
      setCity(station.city);
      setServiceScope(station.service_scope ?? '');
      setDescription(station.description ?? '');
      setStatus(station.status);
      setIsOpen(station.is_open);
      setErrors({});
      setBusy(false);
    }
  }, [open, station]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [busy, onClose]);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name    = t('error_name_required');
    if (!address.trim() || address.trim().length < 5) errs.address = t('error_address_required');
    if (!city.trim() || city.trim().length < 2) errs.city    = t('error_city_required');
    return errs;
  }

  async function handleSubmit() {
    if (!station) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name:    name.trim(),
        address: address.trim(),
        city:    city.trim(),
        status,
        is_open: isOpen,
      };
      if (legalName.trim())    payload.legal_name    = legalName.trim();
      if (serviceScope)        payload.service_scope = serviceScope;
      if (description.trim())  payload.description   = description.trim();

      const [ok, data] = await updateWithApi(`/admin/stations/${station.id}`, payload);
      if (ok) {
        onSaved((data as { data: StationData }).data);
        onClose();
      } else {
        const errData = data as { message?: string };
        setErrors({ general: errData?.message ?? t('error_generic') });
      }
    } catch {
      setErrors({ general: t('error_generic') });
    } finally {
      setBusy(false);
    }
  }

  if (!open || !station) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />

      <div className="relative z-10 w-full max-w-[520px] animate-fade-in-up overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-2xl dark:border-[#1E2E18] dark:bg-[#001201]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <h2 className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('modal_title')}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('btn_cancel')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#BBBBAA] transition-colors hover:bg-[#F0EDE6] hover:text-foreground/70 disabled:opacity-40 dark:hover:bg-[#1A2A14]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-6 py-5">

          {errors.general && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
              {errors.general}
            </div>
          )}

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-stn-name" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_name')}</label>
            <input id="edit-stn-name" type="text" value={name} maxLength={200}
              onChange={(e) => setName(e.target.value)}
              className={`${inputBase} ${errors.name ? inputErr : inputIdle}`} />
            {errors.name && <p className="text-[12px] font-semibold text-red-500">{errors.name}</p>}
          </div>

          {/* Legal name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-stn-legal" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_legal_name')}</label>
            <input id="edit-stn-legal" type="text" value={legalName} maxLength={200}
              onChange={(e) => setLegalName(e.target.value)}
              className={`${inputBase} ${inputIdle}`} />
          </div>

          {/* Address + City */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-stn-address" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_address')}</label>
              <input id="edit-stn-address" type="text" value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`${inputBase} ${errors.address ? inputErr : inputIdle}`} />
              {errors.address && <p className="text-[12px] font-semibold text-red-500">{errors.address}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-stn-city" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_city')}</label>
              <input id="edit-stn-city" type="text" value={city} maxLength={100}
                onChange={(e) => setCity(e.target.value)}
                className={`${inputBase} ${errors.city ? inputErr : inputIdle}`} />
              {errors.city && <p className="text-[12px] font-semibold text-red-500">{errors.city}</p>}
            </div>
          </div>

          {/* Service scope */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-stn-scope" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_service_scope')}</label>
            <select id="edit-stn-scope" value={serviceScope} onChange={(e) => setServiceScope(e.target.value)}
              className={`${inputBase} ${inputIdle} cursor-pointer`}>
              <option value="">{t('scope_unset')}</option>
              {(['exterior', 'interior', 'both'] as const).map((s) => (
                <option key={s} value={s}>{t(`scope_${s}`)}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-stn-desc" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_description')}</label>
            <textarea id="edit-stn-desc" value={description} maxLength={1000} rows={3}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputBase} ${inputIdle} resize-none`} />
          </div>

          {/* Status + is_open */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-stn-status" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_status')}</label>
              <select id="edit-stn-status" value={status} onChange={(e) => setStatus(e.target.value)}
                className={`${inputBase} ${inputIdle} cursor-pointer`}>
                {STATION_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>{t(`status_${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_is_open')}</span>
              <button type="button" onClick={() => setIsOpen((v) => !v)}
                className={[
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-bold transition-all',
                  isOpen
                    ? 'border-[#22C55E]/40 bg-[#F0FDF4] text-[#166534] dark:bg-[#0A2A14] dark:text-[#86EFAC]'
                    : 'border-[#D8D4C8] text-foreground/55 dark:border-[#001A05] dark:text-[#9A9A8A]',
                ].join(' ')}>
                <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-[#22C55E]' : 'bg-[#CCC]'}`} />
                {isOpen ? t('is_open_yes') : t('is_open_no')}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-lg border border-[#D8D4C8] px-4 py-2 text-[13px] font-semibold text-foreground/65 transition-colors hover:bg-[#F5F3EE] disabled:opacity-50 dark:border-[#001A05] dark:text-[#9A9A8A]">
            {t('btn_cancel')}
          </button>
          <button type="button" onClick={handleSubmit} disabled={busy}
            className="rounded-lg bg-[#DDAF3B] px-4 py-2 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14] disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? t('btn_saving') : t('btn_save')}
          </button>
        </div>
      </div>
    </div>
  );
}
