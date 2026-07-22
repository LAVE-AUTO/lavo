'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi, updateWithApi } from '@/services';
import { TextField } from '@/components/station/config/TextField';
import { NumberStepper } from '@/components/station/config/NumberStepper';
import type { StationExtra } from '@/components/station/config/station-extras-types';
import type { ServiceCategoryOption } from './types';

interface Props {
  extra: StationExtra | null;
  categories: ServiceCategoryOption[];
  onClose: () => void;
  onSaved: (extra: StationExtra) => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#B0BFB1]">
      {children}
    </label>
  );
}

export function ExtraModal({ extra, categories, onClose, onSaved }: Props) {
  const t = useTranslations('station_services');
  const tc = useTranslations('common');
  const isEdit = extra !== null;
  const title = isEdit ? t('extra_edit_title') : t('extra_create_title');

  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]?.code ?? '');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (extra) {
      setName(extra.label);
      setCategory(extra.category ?? categories[0]?.code ?? '');
      setPrice(extra.price);
      setDuration(String(extra.duration_min ?? 0));
      setIsActive(extra.is_active);
    } else {
      setName('');
      setCategory(categories[0]?.code ?? '');
      setPrice('');
      setDuration('');
      setIsActive(true);
    }
    setError(null);
  }, [extra, categories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('extra_error_name_required'));
      return;
    }
    if (!category) {
      setError(t('extra_error_category_required'));
      return;
    }
    setSaving(true);
    setError(null);

    const apiPayload = {
      name: trimmedName,
      category,
      price: parseFloat(price) || 0,
      duration: parseInt(duration, 10) || 0,
      is_active: isActive,
    };

    const [ok, data] = extra
      ? await updateWithApi(`/station/extras/${extra.id}`, apiPayload)
      : await postWithApi('/station/extras', apiPayload);

    setSaving(false);

    if (!ok) {
      setError((data as { message?: string })?.message ?? t('extra_error_save'));
      return;
    }

    const raw = (data as { data: Record<string, unknown> }).data;
    const saved: StationExtra = {
      id: String(raw.id),
      label: String(raw.label),
      description: '',
      price: String(raw.price),
      is_active: Boolean(raw.is_active),
      category: (raw.category as string | null) ?? category,
      duration_min: Number(raw.duration_min ?? 0),
      staff_required: 0,
    };
    onSaved(saved);
  }

  const previewName = name.trim() || t('extra_name_label');
  const previewPrice = price || '0';
  const previewDuration = duration || '0';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[640px] xl:max-w-[760px] flex-col rounded-2xl border border-separator/30 bg-card-surface shadow-xl dark:border-[#1A2A14] dark:bg-[#182214]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center border-b border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
          <span className="w-full text-center text-[16px] font-black text-[#001201] dark:text-[#FFF9EC]">
            {title}
          </span>
          {isEdit && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-[#999] transition-colors hover:bg-[#F0EDE4] hover:text-[#333] dark:text-[#5A5A4A] dark:hover:bg-[#001A05] dark:hover:text-[#FFF9EC]"
              aria-label={tc('close')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-5">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>{t('extra_name_label')}</FieldLabel>
                <TextField
                  value={name}
                  onChange={setName}
                  placeholder={t('extra_name_placeholder')}
                  maxLength={80}
                  required
                />
              </div>

              {/* Category — which service category this extra is compatible with. */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>{t('extra_category_label')}</FieldLabel>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('extra_category_label')}>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={category === c.code}
                      onClick={() => setCategory(c.code)}
                      className={`rounded-lg px-3 py-2 text-[12px] font-bold transition-all ${
                        category === c.code
                          ? 'bg-[#DDAF3B] text-[#001201]'
                          : 'bg-[#FFF9EC] text-[#5A5A4A] hover:bg-[#F0EDE4] dark:bg-[#1E2A18] dark:text-[#B0BFB1]'
                      }`}
                    >
                      {t(`cat_${c.code}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>{t('extra_price_label')}</FieldLabel>
                  <NumberStepper value={price} onChange={setPrice} min={0} step={0.5} unit="$" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>{t('extra_duration_label')}</FieldLabel>
                  <NumberStepper value={duration} onChange={setDuration} min={0} step={5} unit="min" />
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-[#DDAF3B]/20 bg-[#FFFDF5] p-4 dark:border-[#DDAF3B]/20 dark:bg-[#1A1808]">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-[#DDAF3B]">{t('extra_preview')}</div>
                <div className="text-[13px] text-[#5A5A4A] dark:text-[#B0BFB1]">
                  <span className="font-bold text-[#001201] dark:text-[#FFF9EC]">{previewName}</span>
                  {' : '}+{previewPrice} $ · +{previewDuration} min
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-[#FF2525]/30 bg-[#FF2525]/10 px-3 py-2 text-[12px] font-semibold text-[#FF2525]">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 border-t border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#DDAF3B] py-2.5 text-[13px] font-bold text-[#001201] transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {saving
                ? isEdit ? t('extra_saving') : t('extra_creating')
                : isEdit ? t('extra_save') : t('extra_create')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-[#FFF9EC] py-2.5 text-[13px] font-semibold text-foreground/65 transition-colors hover:bg-[#F0EDE0] dark:border-[#001A05] dark:text-[#B0BFB1]"
            >
              {tc('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
