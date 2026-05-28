'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { postWithApi, updateWithApi } from '@/services';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { VehicleFormat } from './types';

// Predefined vehicle format suggestions
const SUGGESTIONS_FR = [
  'Micro / Mini', 'Compact', 'Berline', 'Coupé', 'Décapotable',
  'Hatchback', 'Break', 'SUV', 'VUS', 'Crossover',
  'Minivan', 'Fourgonnette', 'Pickup', 'Camion léger',
  'Véhicule électrique', 'Véhicule hybride',
];

const SUGGESTIONS_EN = [
  'Micro / Mini', 'Compact', 'Sedan', 'Coupe', 'Convertible',
  'Hatchback', 'Wagon', 'SUV', 'Crossover', 'Minivan',
  'Van', 'Pickup Truck', 'Light Truck', 'Electric Vehicle', 'Hybrid',
];

interface Props {
  format: VehicleFormat | null;
  existingFormats: VehicleFormat[];
  onClose: () => void;
  onSaved: (format: VehicleFormat) => void;
}

export function VehicleFormatModal({ format, existingFormats, onClose, onSaved }: Props) {
  const t = useTranslations('station_services');
  const locale = useLocale();
  const isEdit = format !== null;

  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(format ? format.label : '');
    setPrice(format ? format.price : '');
    setApiError(null);
    setPriceError(null);
  }, [format]);

  function focusPrice() {
    if (label.trim()) priceRef.current?.focus();
  }

  function validatePrice(v: string): boolean {
    const n = parseFloat(v);
    if (!v || isNaN(n) || n <= 0) {
      setPriceError(t('price_error_positive'));
      return false;
    }
    setPriceError(null);
    return true;
  }

  const isDuplicate =
    !isEdit &&
    label.trim().length > 0 &&
    existingFormats.some((f) => f.label.toLowerCase() === label.trim().toLowerCase());

  const existingLabels = isEdit
    ? existingFormats.filter((f) => f.id !== format.id).map((f) => f.label)
    : existingFormats.map((f) => f.label);

  const canSubmit = label.trim().length > 0 && parseFloat(price) > 0 && !isDuplicate && !saving;

  /* For CREATE: submit directly. For EDIT: open confirmation first. */
  function handleSaveClick(e: React.FormEvent) {
    e.preventDefault();
    if (!validatePrice(price)) return;
    if (!canSubmit) return;
    if (isEdit) {
      setConfirmOpen(true);
    } else {
      doSave();
    }
  }

  async function doSave() {
    setConfirmOpen(false);
    setSaving(true);
    setApiError(null);

    const payload = { label: label.trim(), price: parseFloat(price) };
    const [ok, data] = (isEdit && format)
      ? await updateWithApi(`/station/formats/${format.id}`, { ...payload, is_active: format.is_active })
      : await postWithApi('/station/formats', payload);

    setSaving(false);
    if (ok) {
      onSaved((data as { data: VehicleFormat }).data);
    } else {
      // Never expose raw server messages - map known codes to i18n strings only
      const err = data as { code?: string };
      setApiError(err?.code === 'CONFLICT' ? t('format_label_conflict') : t('format_save_error'));
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-sm rounded-xl border border-[#E8E4DC] bg-white shadow-xl animate-fade-in-up dark:border-[#1A2A14] dark:bg-[#182214]">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
            <div>
              <div className="text-[14px] font-bold text-[#001201] dark:text-[#FFF9EC]">
                {isEdit ? t('format_modal_edit') : t('format_modal_new')}
              </div>
              {!isEdit && (
                <div className="mt-0.5 text-[12px] text-[#BBBBAA] dark:text-[#4A4A3A]">
                  {t('format_choose_vehicle')}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#999] transition-colors hover:bg-[#F0EDE4] hover:text-[#333] dark:text-[#5A5A4A] dark:hover:bg-[#001A05] dark:hover:text-[#FFF9EC]"
              aria-label={t('aria_close')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSaveClick} className="flex flex-col gap-4 p-5">
            {/* Label field - Dropdown select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[#5A5A4A] dark:text-[#9A9A8A]">
                {t('format_field_label')} <span className="text-[#EF4444]">*</span>
              </label>
              
              {/* Dropdown with predefined suggestions */}
              <select
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setApiError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && focusPrice()}
                className="rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#001201] outline-none transition-colors focus:border-[#DDAF3B] focus:bg-white focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.12)] dark:border-[#001A05] dark:bg-[#0F1A0C] dark:text-[#FFF9EC] dark:focus:border-[#DDAF3B] dark:focus:bg-[#182214]"
              >
                <option value="">{t('format_placeholder_label')}</option>
                <optgroup label="Suggestions">
                  {(locale === 'en' ? SUGGESTIONS_EN : SUGGESTIONS_FR).map((fmt) => (
                    <option key={fmt} value={fmt} disabled={existingLabels.includes(fmt)}>
                      {fmt}
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Custom input fallback (hidden if using preset) */}
              {label && !((locale === 'en' ? SUGGESTIONS_EN : SUGGESTIONS_FR).includes(label)) && (
                <input
                  type="text"
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    setApiError(null);
                  }}
                  placeholder="Custom format name"
                  maxLength={100}
                  className="rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#001201] outline-none transition-colors focus:border-[#DDAF3B] focus:bg-white focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.12)] dark:border-[#001A05] dark:bg-[#0F1A0C] dark:text-[#FFF9EC] dark:focus:border-[#DDAF3B] dark:focus:bg-[#182214]"
                />
              )}

              {isDuplicate && (
                <p className="flex items-center gap-1 text-[12px] font-semibold text-[#FF8800]">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {t('format_already_exists')}
                </p>
              )}
            </div>

            {/* Price field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[#5A5A4A] dark:text-[#9A9A8A]">
                {t('format_field_price')} <span className="text-[#EF4444]">*</span>
              </label>
              <div className={`flex items-center gap-2 rounded-[8px] border bg-[#F7F6F2] px-3 py-2.5 transition-all focus-within:shadow-[0_0_0_3px_rgba(221, 175, 59,0.12)] dark:bg-[#0F1A0C] ${
                priceError
                  ? 'border-[#EF4444] focus-within:border-[#EF4444] dark:border-[#6A1A0A]'
                  : 'border-[#D8D4C8] focus-within:border-[#DDAF3B] dark:border-[#001A05] dark:focus-within:border-[#DDAF3B]'
              }`}>
                <span className="shrink-0 font-mono text-[14px] font-bold text-[#DDAF3B]">$</span>
                <input
                  ref={priceRef}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={price}
                  onChange={(e) => { setPrice(e.target.value); setPriceError(null); }}
                  onBlur={() => price && validatePrice(price)}
                  placeholder="0.00"
                  required
                  className="flex-1 bg-transparent font-mono text-[14px] font-bold text-[#001201] outline-none placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-[#BBBBAA] dark:text-[#FFF9EC] dark:placeholder:text-[#4A4A3A]"
                />
                <span className="shrink-0 text-[12px] font-semibold text-[#BBBBAA] dark:text-[#4A4A3A]">CAD</span>
              </div>
              {priceError && (
                <p className="flex items-center gap-1 text-[12px] font-semibold text-[#EF4444]">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                  </svg>
                  {priceError}
                </p>
              )}
            </div>

            {/* API error - i18n-mapped message only, never raw server output */}
            {apiError && (
              <div className="flex items-start gap-2 rounded-[8px] border border-[#FECACA] bg-[#FFF2F0] px-3 py-2.5 dark:border-[#4A0A0A] dark:bg-[#2A0A0A]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 shrink-0 text-[#EF4444]">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                </svg>
                <span className="text-[13px] font-semibold text-[#EF4444] dark:text-[#FF8A80]">{apiError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] border border-[#D8D4C8] px-4 py-2 text-[13px] font-medium text-[#5A5A4A] transition-opacity hover:opacity-70 dark:border-[#001A05] dark:text-[#9A9A8A]"
              >
                {t('btn_cancel')}
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-[10px] bg-[#DDAF3B] px-5 py-2 text-[13px] font-bold text-[#0C1209] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t('btn_saving')}
                  </span>
                ) : t('btn_save')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation dialog for edits */}
      <ConfirmDialog
        open={confirmOpen}
        title={t('confirm_save_title')}
        message={t('confirm_save_message', { name: label.trim(), price: parseFloat(price || '0').toFixed(2) })}
        confirmLabel={t('btn_save')}
        cancelLabel={t('btn_cancel')}
        variant="default"
        loading={saving}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
