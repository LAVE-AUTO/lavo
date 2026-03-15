'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface StationExtra {
  id: string;
  label: string;
  price: string;
  is_active: boolean;
}

export interface StationExtras {
  exterior: StationExtra[];
  interior: StationExtra[];
  both: StationExtra[];
}

interface Props {
  extras: StationExtras;
  onSaved: (extras: StationExtras) => void;
}

type ServiceTab = 'exterior' | 'interior' | 'both';

const inputClass =
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:focus:border-[#C49A1E] dark:focus:bg-[#182214]';

function newExtra(): StationExtra {
  return { id: crypto.randomUUID(), label: '', price: '', is_active: true };
}

export function StationExtrasForm({ extras, onSaved }: Props) {
  const t = useTranslations('station_config');

  const [tab, setTab] = useState<ServiceTab>('exterior');
  const [lists, setLists] = useState<StationExtras>({ ...extras });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const tabs: { key: ServiceTab; label: string }[] = [
    { key: 'exterior', label: t('extras_tab_exterior') },
    { key: 'interior', label: t('extras_tab_interior') },
    { key: 'both', label: t('extras_tab_both') },
  ];

  function updateExtra(scope: ServiceTab, id: string, field: keyof StationExtra, value: string | boolean) {
    setLists((prev) => ({
      ...prev,
      [scope]: prev[scope].map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)),
    }));
  }

  function addExtra(scope: ServiceTab) {
    setLists((prev) => ({ ...prev, [scope]: [...prev[scope], newExtra()] }));
  }

  function removeExtra(scope: ServiceTab, id: string) {
    setLists((prev) => ({ ...prev, [scope]: prev[scope].filter((ex) => ex.id !== id) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    // TODO: connect to API once endpoint is available — PATCH /station/extras does not exist yet
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);

    onSaved(lists);
    setFeedback({ ok: true, msg: t('extras_save_success') });
  }

  const currentList = lists[tab];

  return (
    <form onSubmit={handleSubmit}>
      <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="flex items-center gap-2.5 border-b border-[#F0EDE4] px-5 py-3.5 dark:border-[#1A2A14]">
          <span className="h-4 w-[3px] rounded-full bg-[#C49A1E]" />
          <span className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('section_extras')}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#F0EDE4] px-5 pt-3 dark:border-[#1A2A14]">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-t-[6px] px-4 py-2 text-[12px] font-semibold transition-colors ${
                tab === key
                  ? 'border border-b-0 border-[#E8E4DC] bg-white text-[#C49A1E] dark:border-[#1A2A14] dark:bg-[#182214]'
                  : 'text-[#888] hover:text-[#1A1A0A] dark:hover:text-[#F0EDD4]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {currentList.length === 0 ? (
            <p className="mb-4 text-[12px] text-[#AAAAAA] dark:text-[#5A5A4A]">{t('extras_empty')}</p>
          ) : (
            <div className="mb-4 flex flex-col gap-3">
              {currentList.map((extra) => (
                <div key={extra.id} className="flex items-center gap-2.5">
                  <input
                    type="text"
                    className={inputClass + ' flex-1'}
                    placeholder={t('extras_placeholder_label')}
                    value={extra.label}
                    onChange={(e) => updateExtra(tab, extra.id, 'label', e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className={inputClass + ' w-[100px] flex-none'}
                    placeholder={t('extras_placeholder_price')}
                    value={extra.price}
                    onChange={(e) => updateExtra(tab, extra.id, 'price', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => updateExtra(tab, extra.id, 'is_active', !extra.is_active)}
                    className={`flex-none rounded-[6px] px-3 py-2.5 text-[11px] font-bold transition-all ${
                      extra.is_active
                        ? 'bg-[#C49A1E] text-[#0C1209]'
                        : 'border border-[#D8D4C8] bg-[#F7F6F2] text-[#888] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#6A6A5A]'
                    }`}
                  >
                    {extra.is_active ? t('extras_active') : t('extras_inactive')}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeExtra(tab, extra.id)}
                    className="flex-none rounded-[6px] px-2.5 py-2.5 text-[11px] font-bold text-[#EF4444] transition-colors hover:bg-[#FEE2E2] dark:hover:bg-[#3A1A1A]"
                  >
                    {t('extras_btn_remove')}
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => addExtra(tab)}
            className="flex items-center gap-2 rounded-[8px] border border-dashed border-[#C49A1E] px-4 py-2 text-[12px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#FDF8EC] dark:hover:bg-[#1A1A08]"
          >
            <span className="text-[16px] leading-none">+</span>
            {t('extras_btn_add')}
          </button>

          <div className="mt-5 flex items-center justify-between">
            {feedback && (
              <span className="text-[12px] font-semibold" style={{ color: feedback.ok ? '#00C851' : '#EF4444' }}>
                {feedback.msg}
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="ml-auto rounded-[10px] bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {saving ? t('btn_saving') : t('btn_save')}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
