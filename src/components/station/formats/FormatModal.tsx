'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi, updateWithApi } from '@/services';

export interface VehicleFormat {
  id: string;
  station_id: string;
  label: string;
  price: string;
  is_active: boolean;
}

interface FormatModalProps {
  format: VehicleFormat | null;
  onClose: () => void;
  onSaved: (format: VehicleFormat) => void;
}

const inputClass =
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:focus:border-[#C49A1E] dark:focus:bg-[#182214]';

export function FormatModal({ format, onClose, onSaved }: FormatModalProps) {
  const t = useTranslations('station_formats');

  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = format !== null;

  useEffect(() => {
    if (format) {
      setLabel(format.label);
      setPrice(format.price);
    } else {
      setLabel('');
      setPrice('');
    }
    setError(null);
  }, [format]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !price) return;

    setSaving(true);
    setError(null);

    const payload = { label: label.trim(), price: parseFloat(price) };
    let ok: boolean;
    let data: unknown;

    if (isEdit) {
      [ok, data] = await updateWithApi(`/station/formats/${format.id}`, {
        ...payload,
        is_active: format.is_active,
      });
    } else {
      [ok, data] = await postWithApi('/station/formats', payload);
    }

    setSaving(false);

    if (ok) {
      const res = data as { data: VehicleFormat };
      onSaved(res.data);
    } else {
      setError(t('save_error'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[#E8E4DC] bg-white shadow-xl dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="flex items-center justify-between border-b border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
          <span className="text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
            {isEdit ? t('modal_title_edit') : t('modal_title_add')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[18px] leading-none text-[#999] hover:text-[#333] dark:text-[#5A5A4A] dark:hover:text-[#F0EDD4]"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">
              {t('field_label')}
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('placeholder_label')}
              maxLength={100}
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">
              {t('field_price')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t('placeholder_price')}
                required
                className={inputClass + ' pr-8'}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#BBBBAA] dark:text-[#4A4A3A]">
                $
              </span>
            </div>
          </div>

          {error && (
            <p className="text-[12px] font-semibold text-[#EF4444]">{error}</p>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-[#D8D4C8] px-4 py-2 text-[13px] font-medium text-[#5A5A4A] transition-opacity hover:opacity-70 dark:border-[#243020] dark:text-[#9A9A8A]"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !label.trim() || !price}
              className="rounded-[10px] bg-[#C49A1E] px-5 py-2 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {saving ? t('btn_saving') : t('btn_save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
