'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/** Per-vehicle pricing entry, mirrors ServiceVehicleEntry shape from formats/types.ts. */
export interface ExtraVehicleEntry {
  vehicle_format_id: string;
  vehicle_label: string;
  price: string;
  duration_min: number;
}

export interface StationExtra {
  id: string;
  label: string;
  description: string;
  price: string;
  is_active: boolean;
  scope?: 'exterior' | 'interior' | 'both';
  duration_min?: number;
  staff_required?: number;
  /** Optional per-vehicle pricing. When absent, the flat `price` applies to all formats. */
  vehicle_entries?: ExtraVehicleEntry[];
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
  return { id: crypto.randomUUID(), label: '', description: '', price: '', is_active: true };
}

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

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

  function addExtra() {
    setLists((prev) => ({ ...prev, [tab]: [...prev[tab], newExtra()] }));
  }

  function removeExtra(id: string) {
    setLists((prev) => ({ ...prev, [tab]: prev[tab].filter((ex) => ex.id !== id) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    // TODO: connect to API once endpoint is available - PATCH /station/extras does not exist yet
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);

    onSaved(lists);
    setFeedback({ ok: true, msg: t('extras_save_success') });
  }

  const currentList = lists[tab];

  return (
    <form onSubmit={handleSubmit}>
      <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-[#F0EDE4] px-5 py-3.5 dark:border-[#1A2A14]">
          <span className="h-4 w-[3px] rounded-full bg-[#C49A1E]" />
          <span className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('section_extras')}</span>
        </div>

        {/* Service type tabs */}
        <div className="flex gap-px border-b border-[#F0EDE4] px-5 pt-3.5 dark:border-[#1A2A14]">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative px-5 pb-3 text-[13px] font-semibold transition-colors duration-150 ${
                tab === key
                  ? 'text-[#C49A1E]'
                  : 'text-[#AAAAAA] hover:text-[#5A5A4A] dark:text-[#4A4A3A] dark:hover:text-[#9A9A8A]'
              }`}
            >
              {label}
              {tab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[#C49A1E]" />
              )}
              {lists[key].length > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  tab === key ? 'bg-[#FDF3D8] text-[#C49A1E] dark:bg-[#2A1E08]' : 'bg-[#F0EFEB] text-[#BBBBAA] dark:bg-[#1A2A14] dark:text-[#4A4A3A]'
                }`}>
                  {lists[key].length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Extra cards */}
          {currentList.length === 0 ? (
            <div className="mb-4 flex h-16 items-center justify-center rounded-[10px] border border-dashed border-[#E0DCD4] text-[13px] text-[#BBBBAA] dark:border-[#243020] dark:text-[#4A4A3A]">
              {t('extras_empty')}
            </div>
          ) : (
            <div className="mb-4 flex flex-col gap-3">
              {currentList.map((extra) => (
                <div
                  key={extra.id}
                  className="rounded-[10px] border border-[#EDEBE5] bg-[#FAFAF7] p-4 transition-shadow hover:shadow-sm dark:border-[#243020] dark:bg-[#0D170A]"
                >
                  {/* Row 1: name + price + toggle + delete */}
                  <div className="flex items-center gap-2.5">
                    <input
                      type="text"
                      className={inputClass + ' flex-1'}
                      placeholder={t('extras_placeholder_label')}
                      value={extra.label}
                      onChange={(e) => updateExtra(tab, extra.id, 'label', e.target.value)}
                    />

                    {/* Price with $ prefix */}
                    <div className="relative w-[110px] flex-none">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[13px] font-semibold text-[#C49A1E]">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className={inputClass + ' pl-7'}
                        placeholder={t('extras_placeholder_price')}
                        value={extra.price}
                        onChange={(e) => updateExtra(tab, extra.id, 'price', e.target.value)}
                      />
                    </div>

                    {/* Active toggle */}
                    <button
                      type="button"
                      onClick={() => updateExtra(tab, extra.id, 'is_active', !extra.is_active)}
                      className={`flex-none rounded-[7px] px-3 py-2.5 text-[12px] font-bold transition-all duration-150 ${
                        extra.is_active
                          ? 'bg-[#C49A1E] text-[#0C1209]'
                          : 'border border-[#D8D4C8] bg-[#F7F6F2] text-[#AAAAAA] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#5A5A4A]'
                      }`}
                    >
                      {extra.is_active ? t('extras_active') : t('extras_inactive')}
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => removeExtra(extra.id)}
                      className="flex-none rounded-[7px] p-2.5 text-[#C8C4BC] transition-colors hover:bg-[#FEE2E2] hover:text-[#EF4444] dark:text-[#3A3A2A] dark:hover:bg-[#3A1A1A] dark:hover:text-[#EF4444]"
                    >
                      <TrashIcon />
                    </button>
                  </div>

                  {/* Row 2: description (optional) */}
                  <div className="mt-2.5">
                    <input
                      type="text"
                      className={inputClass + ' text-[13px]'}
                      placeholder={t('extras_placeholder_description')}
                      value={extra.description}
                      onChange={(e) => updateExtra(tab, extra.id, 'description', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          <button
            type="button"
            onClick={addExtra}
            className="flex items-center gap-2 rounded-[8px] border border-dashed border-[#C49A1E]/50 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] transition-all hover:border-[#C49A1E] hover:bg-[#FDF8EC] dark:hover:bg-[#1A1A08]"
          >
            <span className="text-[15px] leading-none font-light">+</span>
            {t('extras_btn_add')}
          </button>

          {/* Footer */}
          <div className="mt-5 flex items-center justify-between">
            {feedback ? (
              <span className="text-[13px] font-semibold" style={{ color: feedback.ok ? '#00C851' : '#EF4444' }}>
                {feedback.msg}
              </span>
            ) : <span />}
            <button
              type="submit"
              disabled={saving}
              className="rounded-[10px] bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {saving ? t('btn_saving') : t('btn_save')}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
