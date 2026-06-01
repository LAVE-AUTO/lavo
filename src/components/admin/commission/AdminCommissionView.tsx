'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { useCommission } from '@/context/commission-context';
import { updateWithApi } from '@/services/axios-service';

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export function AdminCommissionView() {
  const t = useTranslations('admin_commission');
  const { success: toastSuccess, error: toastError } = useToast();
  const { user } = useAuth();
  const { rate: savedRate, history, loading: historyLoading, updateRate, reload } = useCommission();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const resolveSetBy = useCallback((setBy: string) => {
    if (!setBy) return '-';
    if (user?.id && setBy === user.id) {
      return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
    }
    // The current API does not expose other admins' display names.
    // Use a human label instead of leaking UUIDs into the UI.
    if (/^[0-9a-f]{8}-/i.test(setBy)) return t('set_by_admin');
    return setBy;
  }, [user]);

  const [rate, setRate]     = useState(savedRate);
  const [saving, setSaving] = useState(false);

  /* Sync local input when savedRate changes (e.g. changed from platform-settings) */
  useEffect(() => { setRate(savedRate); }, [savedRate]);

  const isDirty      = rate !== savedRate;
  const stationShare = Math.round((100 - rate) * 10) / 10;
  const barWidth     = Math.max(2, Math.min(98, rate));

  async function handleSave() {
    const rounded = Math.round(rate * 10) / 10;
    if (rounded < 0 || rounded > 100) { toastError(t('error_range')); return; }
    setSaving(true);
    try {
      const decimalRate = rounded / 100;
      const [ok] = await updateWithApi('/admin/commission', { rate: decimalRate });
      if (!mountedRef.current) return;
      if (ok) {
        updateRate(rounded);
        await reload();
        toastSuccess(t('save_success'));
      } else {
        toastError(t('save_error'));
      }
    } catch {
      if (mountedRef.current) toastError(t('save_error'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-separator bg-transparent px-6 py-5 dark:border-[#1A2A14] dark:bg-dark-bg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('page_title')}</h1>
            <p className="mt-1 text-[13px] text-foreground/55 dark:text-[#B0BFB1]">{t('page_subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#DDAF3B]/30 bg-[#DDAF3B]/10 px-3 py-1 text-[12px] font-black text-[#7A5E0A] dark:border-[#DDAF3B]/20 dark:text-[#DDAF3B]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#DDAF3B]" />
            <span>{savedRate}%</span>
            <span className="font-semibold uppercase tracking-[0.12em] opacity-80">{t('chip_current')}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#FFF9EC] p-6 dark:bg-dark-bg">
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#FFF9EC] bg-white px-5 py-4 shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('label_rate')}</p>
            <p className="mt-2 text-[28px] font-black leading-none text-[#001201] dark:text-[#FFF9EC]">{savedRate}%</p>
            <p className="mt-2 text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{t('hint_rate')}</p>
          </div>
          <div className="rounded-2xl border border-[#FFF9EC] bg-white px-5 py-4 shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('platform_share')}</p>
            <p className="mt-2 text-[28px] font-black leading-none text-[#DDAF3B]">{savedRate}%</p>
            <p className="mt-2 text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{t('preview_title')}</p>
          </div>
          <div className="rounded-2xl border border-[#FFF9EC] bg-white px-5 py-4 shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('station_share')}</p>
            <p className="mt-2 text-[28px] font-black leading-none text-[#5A8A50]">{100 - savedRate}%</p>
            <p className="mt-2 text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{t('preview_title')}</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">

          {/* Left: form */}
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-2xl border border-[#FFF9EC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
              <div className="border-b border-[#F0EDE6] bg-gradient-to-r from-[#F9F8F5] to-white px-5 py-3 dark:border-[#1A2A14] dark:from-[#0E1A0C] dark:to-[#131E10]">
                <p className="text-[12px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('section_current')}</p>
              </div>
              <div className="p-5">
                <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-[#B0BFB1] dark:text-[#B0BFB1]">{t('label_rate')}</p>
                {/* Big rate input */}
                <div className="flex overflow-hidden rounded-xl border-2 border-[#D8D4C8] bg-white transition-all focus-within:border-[#DDAF3B] focus-within:shadow-[0_0_0_4px_rgba(221, 175, 59,0.12)] dark:border-[#001A05] dark:bg-dark-bg dark:focus-within:border-[#DDAF3B]">
                  <input type="number" min={0} max={100} step={0.5} value={rate}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setRate(Math.min(100, Math.max(0, v))); }}
                    className="flex-1 bg-transparent px-5 py-4 text-[32px] font-black text-[#001201] outline-none [appearance:textfield] dark:text-[#FFF9EC]" />
                  <span className="flex items-center border-l border-[#FFF9EC] bg-[#F5F2EC] px-5 text-[20px] font-black text-[#AAAAAA] dark:border-[#001A05] dark:bg-[#0E1A0C]">%</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-[#AAAAAA] dark:text-[#B0BFB1]">{t('hint_rate')}</p>

                {/* Split preview bar */}
                <div className="mt-5">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('preview_title')}</p>
                  <div className="flex h-9 overflow-hidden rounded-xl bg-[#F0EDE6] dark:bg-[#1A2A14]">
                    <div className="flex items-center justify-center bg-[#DDAF3B] text-[11px] font-black text-[#001201] transition-all duration-500"
                      style={{ width: `${barWidth}%` }}>
                      {rate > 8 && `${rate}%`}
                    </div>
                    <div className="flex flex-1 items-center justify-center text-[11px] font-bold text-foreground/55 dark:text-[#B0BFB1]">
                      {stationShare > 8 && `${stationShare}%`}
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-[12px] font-bold">
                    <span className="text-[#DDAF3B]">{t('platform_share')}</span>
                    <span className="text-foreground/55 dark:text-[#B0BFB1]">{t('station_share')}</span>
                  </div>
                </div>

                <button type="button" disabled={saving || !isDirty} onClick={handleSave}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#DDAF3B] px-4 py-3 text-[13px] font-bold text-[#001201] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#B08A14] hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">
                  {isDirty && !saving && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-dark-bg" />}
                  {saving ? t('btn_saving') : t('btn_save')}
                </button>
                {isDirty && !saving && (
                  <p className="mt-2 text-center text-[12px] font-semibold text-[#DDAF3B]">{t('unsaved_dot')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: history */}
          <div className="overflow-hidden rounded-2xl border border-[#FFF9EC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
            <div className="border-b border-[#F0EDE6] bg-gradient-to-r from-[#F9F8F5] to-white px-5 py-3 dark:border-[#1A2A14] dark:from-[#0E1A0C] dark:to-[#131E10]">
              <p className="text-[12px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('section_history')}</p>
            </div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
              </div>
            ) : history.length === 0 ? (
              <p className="p-8 text-center text-[13px] text-[#999]">{t('empty_history')}</p>
            ) : (
              <>
                <div className="grid grid-cols-[80px_1fr_100px] gap-4 border-b border-[#F0EDE6] px-5 py-2.5 dark:border-[#1A2A14]">
                  {[t('col_rate'), t('col_set_by'), t('col_effective')].map((h) => (
                    <span key={h} className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{h}</span>
                  ))}
                </div>
                {history.map((h, i) => {
                  const prev      = history[i + 1];
                  const up        = prev ? h.rate > prev.rate : false;
                  const same      = prev ? h.rate === prev.rate : true;
                  const isCurrent = i === 0;
                  return (
                    <div key={h.id}
                      className={`grid grid-cols-[80px_1fr_100px] items-center gap-4 border-b px-5 py-3.5 last:border-0 transition-colors ${isCurrent ? 'border-[#F0EDE6] bg-[#FEFCF5] dark:border-[#1A2A14] dark:bg-[#182416]' : 'border-[#F5F2ED] bg-white hover:bg-[#FAFAF7] dark:border-[#1A2A14] dark:bg-[#131E10] dark:hover:bg-[#182416]'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-[18px] font-black ${isCurrent ? 'text-[#DDAF3B]' : 'text-[#001201] dark:text-[#FFF9EC]'}`}>{h.rate}%</span>
                        {!same && <span className={`text-[11px] font-black ${up ? 'text-[#F97316]' : 'text-[#22C55E]'}`}>{up ? '▲' : '▼'}</span>}
                        {isCurrent && <span className="rounded-full bg-[#DDAF3B]/15 px-1.5 py-0.5 text-[9px] font-black text-[#7A5E0A] dark:text-[#DDAF3B]">live</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-foreground/65 dark:text-[#B0BFB1]">{resolveSetBy(h.set_by)}</p>
                        {h.set_by && /^[0-9a-f]{8}-/i.test(h.set_by) && (
                          <p className="mt-0.5 text-[11px] text-[#BBBBAA] dark:text-[#B0BFB1]">{t('set_by_admin')}</p>
                        )}
                      </div>
                      <p className="text-[12px] text-[#BBBBAA] dark:text-[#B0BFB1]">{formatDate(h.effective_at)}</p>
                    </div>
                  );
                })}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
