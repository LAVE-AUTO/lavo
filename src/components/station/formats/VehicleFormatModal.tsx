'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { postWithApi, updateWithApi } from '@/services';
import { VehicleLabelAutocomplete } from './VehicleLabelAutocomplete';
import type { VehicleFormat } from './types';

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
  const [error, setError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(format ? format.label : '');
    setPrice(format ? format.price : '');
    setError(null);
    setPriceError(null);
  }, [format]);

  /* Move focus to price when label is selected from autocomplete */
  function focusPrice() {
    if (label.trim()) priceRef.current?.focus();
  }

  function validatePrice(v: string): boolean {
    const n = parseFloat(v);
    if (!v || isNaN(n) || n <= 0) {
      setPriceError(locale === 'en' ? 'Price must be greater than 0' : 'Le prix doit être supérieur à 0');
      return false;
    }
    setPriceError(null);
    return true;
  }

  /* Check for duplicate label (on create only) */
  const isDuplicate =
    !isEdit &&
    label.trim().length > 0 &&
    existingFormats.some((f) => f.label.toLowerCase() === label.trim().toLowerCase());

  const existingLabels = isEdit
    ? existingFormats.filter((f) => f.id !== format.id).map((f) => f.label)
    : existingFormats.map((f) => f.label);

  const canSubmit = label.trim().length > 0 && price.length > 0 && !isDuplicate && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validatePrice(price)) return;
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    const payload = { label: label.trim(), price: parseFloat(price) };
    const [ok, data] = isEdit
      ? await updateWithApi(`/station/formats/${format.id}`, { ...payload, is_active: format.is_active })
      : await postWithApi('/station/formats', payload);

    setSaving(false);
    if (ok) {
      onSaved((data as { data: VehicleFormat }).data);
    } else {
      setError(t('format_save_error'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-xl border border-[#E8E4DC] bg-white shadow-xl dark:border-[#1A2A14] dark:bg-[#182214] animate-fade-in-up sm:animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
          <div>
            <div className="text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
              {isEdit ? t('format_modal_edit') : t('format_modal_new')}
            </div>
            {!isEdit && (
              <div className="mt-0.5 text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">
                {locale === 'en' ? 'Define a vehicle category and its base price' : 'Définissez une catégorie de véhicule et son prix de base'}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#999] transition-colors hover:bg-[#F0EDE4] hover:text-[#333] dark:text-[#5A5A4A] dark:hover:bg-[#243020] dark:hover:text-[#F0EDD4]"
            aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          {/* Label field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#5A5A4A] dark:text-[#9A9A8A]">
              {t('format_field_label')} <span className="text-[#EF4444]">*</span>
            </label>
            <VehicleLabelAutocomplete
              value={label}
              onChange={(v) => { setLabel(v); setError(null); }}
              onEnter={focusPrice}
              existingLabels={existingLabels}
              locale={locale}
              placeholder={t('format_placeholder_label')}
            />
            {isDuplicate && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-[#FF8800]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {locale === 'en' ? 'This format already exists' : 'Ce format existe déjà'}
              </p>
            )}
          </div>

          {/* Price field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#5A5A4A] dark:text-[#9A9A8A]">
              {t('format_field_price')} <span className="text-[#EF4444]">*</span>
            </label>
            <div className={`flex items-center gap-2 rounded-[8px] border bg-[#F7F6F2] px-3 py-2.5 transition-all focus-within:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:bg-[#0F1A0C] ${
              priceError
                ? 'border-[#EF4444] bg-[#FFF8F7] focus-within:border-[#EF4444] dark:border-[#6A1A0A]'
                : 'border-[#D8D4C8] focus-within:border-[#C49A1E] dark:border-[#243020] dark:focus-within:border-[#C49A1E]'
            }`}>
              <span className="shrink-0 font-mono text-[14px] font-bold text-[#C49A1E]">$</span>
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
                className="flex-1 bg-transparent font-mono text-[14px] font-bold text-[#1A1A0A] outline-none placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-[#BBBBAA] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A]"
              />
              <span className="shrink-0 text-[11px] font-semibold text-[#BBBBAA] dark:text-[#4A4A3A]">CAD</span>
            </div>
            {priceError && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-[#EF4444]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                </svg>
                {priceError}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-[8px] bg-[#FFF2F0] px-3 py-2.5 text-[12px] font-semibold text-[#EF4444] dark:bg-[#2A0A0A] dark:text-[#FF8A80]">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-[10px] border border-[#D8D4C8] px-4 py-2 text-[13px] font-medium text-[#5A5A4A] transition-opacity hover:opacity-70 dark:border-[#243020] dark:text-[#9A9A8A]">
              {t('btn_cancel')}
            </button>
            <button type="submit" disabled={!canSubmit}
              className="rounded-[10px] bg-[#C49A1E] px-5 py-2 text-[13px] font-bold text-[#0C1209] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
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
  );
}
