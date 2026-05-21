'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, patchWithApi } from '@/services';
import { LegalEditor } from './legal/LegalEditor';

type PageKey =
  | 'privacy'
  | 'terms_clients'
  | 'terms_stations'
  | 'legal_mentions'
  | 'contact'
  | 'how_it_works';

type BackendKey = 'cgu' | 'politique_confidentialite' | 'mentions_legales';

const PAGE_TO_BACKEND: Partial<Record<PageKey, BackendKey>> = {
  privacy:        'politique_confidentialite',
  terms_clients:  'cgu',
  legal_mentions: 'mentions_legales',
};

const PAGES: { key: PageKey; labelKey: string }[] = [
  { key: 'privacy',        labelKey: 'page_privacy' },
  { key: 'terms_clients',  labelKey: 'page_terms_clients' },
  { key: 'terms_stations', labelKey: 'page_terms_stations' },
  { key: 'legal_mentions', labelKey: 'page_legal_mentions' },
  { key: 'contact',        labelKey: 'page_contact' },
  { key: 'how_it_works',   labelKey: 'page_how_it_works' },
];

const INITIAL_CONTENTS: Record<PageKey, string> = {
  privacy:        '',
  terms_clients:  '',
  terms_stations: '',
  legal_mentions: '',
  contact:        '',
  how_it_works:   '',
};

interface ApiLegalResponse { data: { key: BackendKey; content: string } }

export function AdminLegalContent() {
  const t                    = useTranslations('admin_legal');
  const { success, error: showError } = useToast();
  const mountedRef           = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [activePage, setActivePage] = useState<PageKey>('privacy');
  const [contents,   setContents]   = useState<Record<PageKey, string>>({ ...INITIAL_CONTENTS });
  const [dirty,      setDirty]      = useState<Set<PageKey>>(new Set());
  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);

    Promise.all(
      (Object.entries(PAGE_TO_BACKEND) as Array<[PageKey, BackendKey]>).map(async ([pageKey, backendKey]) => {
        const [ok, data] = await getFromApi<ApiLegalResponse>(`/admin/legal/${backendKey}`);
        return { pageKey, backendKey, ok, content: ok ? ((data as ApiLegalResponse)?.data?.content ?? '') : '' };
      }),
    )
      .then((results) => {
        if (!active) return;
        const next: Record<PageKey, string> = { ...INITIAL_CONTENTS };
        for (const { pageKey, content } of results) next[pageKey] = content;
        setContents(next);
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  function handleChange(html: string) {
    setContents(prev => ({ ...prev, [activePage]: html }));
    setDirty(prev => { const s = new Set(prev); s.add(activePage); return s; });
  }

  async function handleSave() {
    const backendKey = PAGE_TO_BACKEND[activePage];
    if (!backendKey) return;

    const html = (contents[activePage] ?? '').trim();
    if (!html) { showError(t('error_empty')); return; }

    setSaving(true);
    try {
      const [ok, data] = await patchWithApi<ApiLegalResponse>(`/admin/legal/${backendKey}`, { content: html });
      if (!mountedRef.current) return;
      if (!ok) { showError(t('save_error')); return; }
      const sanitized = (data as ApiLegalResponse)?.data?.content;
      if (typeof sanitized === 'string') {
        setContents(prev => ({ ...prev, [activePage]: sanitized }));
      }
      setDirty(prev => { const s = new Set(prev); s.delete(activePage); return s; });
      success(t('save_success'));
    } catch {
      if (mountedRef.current) showError(t('save_error'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  const pageBtn = (key: PageKey) => {
    const isUnsupported = !PAGE_TO_BACKEND[key];
    const isActive = activePage === key;
    return [
      'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition-colors',
      isActive
        ? 'bg-[#C49A1E] text-[#0C1209]'
        : isUnsupported
          ? 'text-[#999] hover:bg-[#E8E4D8]/60 dark:text-[#7E8A75] dark:hover:bg-[#182214]'
          : 'text-[#555] hover:bg-[#E8E4D8] dark:text-[#9A9A8A] dark:hover:bg-[#182214]',
    ].join(' ');
  };

  const activeSupported = !!PAGE_TO_BACKEND[activePage];

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* Header */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#C49A1E]">{t('section_title')}</p>
        <p className="mt-0.5 text-[13px] text-[#888] dark:text-[#9A9A8A]">{t('section_subtitle')}</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">

        {/* Page list */}
        <div className="flex shrink-0 flex-col gap-1 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06] lg:w-[200px]">
          {PAGES.map(({ key, labelKey }) => (
            <button key={key} type="button" onClick={() => setActivePage(key)} className={pageBtn(key)}>
              <span className="flex items-center gap-2">
                {t(labelKey)}
                {!PAGE_TO_BACKEND[key] && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    {t('badge_pending')}
                  </span>
                )}
              </span>
              {dirty.has(key) && (
                <span className={`h-2 w-2 shrink-0 rounded-full ${activePage === key ? 'bg-[#0C1209]/40' : 'bg-[#C49A1E]'}`} aria-label={t('unsaved_indicator')} />
              )}
            </button>
          ))}
        </div>

        {/* Editor panel */}
        <div className="flex flex-1 flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-[#E8E4DC] bg-white p-12 dark:border-[#1E2E18] dark:bg-[#131E10]">
              <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-12 text-center dark:border-red-900/40 dark:bg-red-950/30">
              <p className="text-[13px] font-semibold text-red-600 dark:text-red-300">{t('load_error')}</p>
            </div>
          ) : activeSupported ? (
            <>
              <LegalEditor
                pageKey={activePage}
                html={contents[activePage]}
                onChange={handleChange}
                disabled={saving}
              />

              <div className="flex items-center justify-between">
                {dirty.has(activePage) && (
                  <p className="text-[12px] text-[#FF8800]">{t('unsaved_changes')}</p>
                )}
                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !dirty.has(activePage)}
                    className="flex items-center gap-2 rounded-xl bg-[#C49A1E] px-5 py-2.5 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14] disabled:opacity-50"
                  >
                    {saving && (
                      <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    )}
                    {saving ? t('btn_saving') : t('btn_save')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-300/40 bg-amber-50 p-6 dark:border-amber-500/20 dark:bg-amber-950/15">
              <div className="flex items-start gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[13px] font-bold text-amber-800 dark:text-amber-300">{t('backend_missing_title')}</p>
                  <p className="text-[12px] leading-snug text-amber-800/80 dark:text-amber-300/80">{t('backend_missing_desc')}</p>
                  <p className="mt-1 font-mono text-[11px] font-semibold text-amber-900/70 dark:text-amber-300/70">
                    GET / PATCH /admin/legal/{activePage}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
