'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, patchWithApi } from '@/services';
import { LegalEditor } from './legal/LegalEditor';

type BackendKey =
  | 'cgu'
  | 'cgu_stations'
  | 'politique_confidentialite'
  | 'mentions_legales'
  | 'contact'
  | 'landing_how_it_works';

interface LegalPage {
  key: BackendKey;
  labelKey: string;
  descKey: string;
  icon: React.ReactNode;
}

const PAGES: LegalPage[] = [
  {
    key: 'politique_confidentialite',
    labelKey: 'page_privacy',
    descKey: 'page_privacy_desc',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    key: 'cgu',
    labelKey: 'page_terms_clients',
    descKey: 'page_terms_clients_desc',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    key: 'cgu_stations',
    labelKey: 'page_terms_stations',
    descKey: 'page_terms_stations_desc',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    key: 'mentions_legales',
    labelKey: 'page_legal_mentions',
    descKey: 'page_legal_mentions_desc',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  {
    key: 'contact',
    labelKey: 'page_contact',
    descKey: 'page_contact_desc',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.36 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  {
    key: 'landing_how_it_works',
    labelKey: 'page_how_it_works',
    descKey: 'page_how_it_works_desc',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

interface ApiLegalResponse { data: { key: BackendKey; content: string } }

function plainTextFromHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
}

export function AdminLegalContent() {
  const t                    = useTranslations('admin_legal');
  const { success, error: showError } = useToast();
  const mountedRef           = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [activePage, setActivePage]   = useState<BackendKey>('politique_confidentialite');
  const [contents,   setContents]     = useState<Record<BackendKey, string>>({} as Record<BackendKey, string>);
  const [savedAt,    setSavedAt]      = useState<Record<BackendKey, string>>({} as Record<BackendKey, string>);
  const [dirty,      setDirty]        = useState<Set<BackendKey>>(new Set());
  const [saving,     setSaving]       = useState(false);
  const [loadedKeys, setLoadedKeys]   = useState<Set<BackendKey>>(new Set());
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError,   setPageError]   = useState(false);

  const loadPage = useCallback(async (key: BackendKey) => {
    setPageLoading(true);
    setPageError(false);
    const [ok, data] = await getFromApi<ApiLegalResponse>(`/admin/legal/${key}`);
    if (!mountedRef.current) return;
    if (!ok) {
      setPageError(true);
      setPageLoading(false);
      return;
    }
    const content = (data as ApiLegalResponse)?.data?.content ?? '';
    setContents((prev) => ({ ...prev, [key]: content }));
    setLoadedKeys((prev) => new Set(prev).add(key));
    setPageLoading(false);
  }, []);

  /* Lazy-load the active page if it has never been fetched */
  useEffect(() => {
    if (loadedKeys.has(activePage)) {
      setPageError(false);
      return;
    }
    loadPage(activePage);
  }, [activePage, loadedKeys, loadPage]);

  function handleChange(html: string) {
    setContents((prev) => ({ ...prev, [activePage]: html }));
    setDirty((prev) => { const s = new Set(prev); s.add(activePage); return s; });
  }

  async function handleSave() {
    const html = (contents[activePage] ?? '').trim();
    if (!html) { showError(t('error_empty')); return; }

    setSaving(true);
    try {
      const [ok, data] = await patchWithApi<ApiLegalResponse>(`/admin/legal/${activePage}`, { content: html });
      if (!mountedRef.current) return;
      if (!ok) { showError(t('save_error')); return; }
      const sanitized = (data as ApiLegalResponse)?.data?.content;
      if (typeof sanitized === 'string') {
        setContents((prev) => ({ ...prev, [activePage]: sanitized }));
      }
      setDirty((prev) => { const s = new Set(prev); s.delete(activePage); return s; });
      setSavedAt((prev) => ({ ...prev, [activePage]: new Date().toISOString() }));
      success(t('save_success'));
    } catch {
      if (mountedRef.current) showError(t('save_error'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  function handleDiscard() {
    setDirty((prev) => { const s = new Set(prev); s.delete(activePage); return s; });
    setLoadedKeys((prev) => { const s = new Set(prev); s.delete(activePage); return s; });
    setContents((prev) => ({ ...prev, [activePage]: '' }));
    loadPage(activePage);
  }

  const activeMeta = PAGES.find((p) => p.key === activePage)!;
  const activeContent = contents[activePage] ?? '';
  const isActiveDirty = dirty.has(activePage);
  const text = plainTextFromHtml(activeContent);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const charCount = text.length;
  const lastSaved = savedAt[activePage];

  const dirtyCount = dirty.size;
  const totalPages = PAGES.length;

  const metrics = [
    { label: t('metric_pages'),    value: String(totalPages),                                                  accent: '#C49A1E' },
    { label: t('metric_dirty'),    value: String(dirtyCount),                                                  accent: dirtyCount > 0 ? '#F97316' : '#94A3B8' },
    { label: t('metric_words'),    value: text ? String(wordCount) : '—',                                       accent: '#3B82F6' },
    { label: t('metric_chars'),    value: text ? String(charCount) : '—',                                       accent: '#22C55E' },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_32%),linear-gradient(180deg,#0C1209_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-5 overflow-y-auto scrollbar-none px-3 py-4 sm:px-4 lg:px-6 lg:py-6">

        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#C49A1E]/18 bg-[#C49A1E]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:border-[#C49A1E]/25 dark:bg-[#C49A1E]/12 dark:text-[#F0D98C]">
                {t('badge_content')}
              </span>
              <h1 className="mt-4 text-[clamp(28px,3vw,42px)] font-black leading-[1.04] text-[#1A1A0A] dark:text-[#F0EDD4]">
                {t('section_title')}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#6F6B5F] dark:text-[#A6A091]">
                {t('section_subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:w-[640px] 2xl:w-[720px]">
              {metrics.map((metric) => (
                <div key={metric.label} className="group relative overflow-hidden rounded-[24px] border border-[#E9E4D8] bg-[#FBFAF7] px-5 py-4 shadow-[0_10px_30px_rgba(26,26,10,0.05)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-[#1E2E18] dark:bg-[#0C150B]">
                  <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: metric.accent }} />
                  <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-3xl opacity-15 transition-opacity duration-200 group-hover:opacity-25" style={{ background: metric.accent }} />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{metric.label}</div>
                    <div className="mt-3 text-[28px] font-black leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">{metric.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-1 min-h-0 flex-col gap-4 rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)] lg:flex-row lg:gap-5">

          {/* Sidebar */}
          <aside className="flex shrink-0 flex-col gap-2 rounded-[20px] border border-[#E9E4D8] bg-[#FBFAF7]/90 p-2 dark:border-[#1E2E18] dark:bg-[#0C150B]/85 lg:w-[260px]">
            <p className="px-3 pt-2 text-[10.5px] font-black uppercase tracking-[0.2em] text-[#9B9588] dark:text-[#7E8A75]">
              {t('section_pages')}
            </p>
            {PAGES.map((p) => {
              const isActive = activePage === p.key;
              const isDirty  = dirty.has(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setActivePage(p.key)}
                  className={[
                    'group flex w-full items-start gap-3 rounded-[14px] px-3 py-2.5 text-left transition-all duration-150',
                    isActive
                      ? 'bg-[#1A1A0A] text-[#F0EDD4] shadow-[0_10px_24px_rgba(26,26,10,0.18)] dark:bg-[#F0EDD4] dark:text-[#1A1A0A]'
                      : 'text-[#5A554B] hover:bg-white hover:shadow-[0_4px_10px_rgba(26,26,10,0.05)] dark:text-[#A6A091] dark:hover:bg-[#182214]',
                  ].join(' ')}
                >
                  <span className={[
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px]',
                    isActive ? 'bg-[#F0EDD4]/15 text-[#F0EDD4] dark:bg-[#1A1A0A]/12 dark:text-[#1A1A0A]' : 'bg-[#1A1A0A]/5 text-[#5A554B] dark:bg-[#F0EDD4]/8 dark:text-[#A6A091]',
                  ].join(' ')}>
                    {p.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-bold">{t(p.labelKey)}</span>
                      {isDirty && (
                        <span className={[
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          isActive ? 'bg-[#F0D98C]' : 'bg-[#C49A1E]',
                        ].join(' ')} aria-label={t('unsaved_indicator')} />
                      )}
                    </span>
                    <span className={[
                      'mt-0.5 block truncate text-[11.5px]',
                      isActive ? 'text-[#F0EDD4]/60 dark:text-[#1A1A0A]/60' : 'text-[#9B9588] dark:text-[#7E8A75]',
                    ].join(' ')}>
                      {t(p.descKey)}
                    </span>
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Editor pane */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t(activeMeta.labelKey)}</h2>
                <p className="mt-0.5 text-[12px] text-[#9B9588] dark:text-[#7E8A75]">
                  {isActiveDirty ? (
                    <span className="font-bold text-[#C2410C] dark:text-[#FDBA74]">{t('unsaved_changes')}</span>
                  ) : lastSaved ? (
                    t('saved_at', { time: new Date(lastSaved).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }) })
                  ) : (
                    t(activeMeta.descKey)
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={saving || !isActiveDirty}
                  className="inline-flex items-center gap-1.5 rounded-[12px] border border-[#E1DBCF] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#5A554B] transition-all hover:border-[#C49A1E]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#A6A091] dark:hover:bg-[#1A2410] dark:hover:text-[#F0D98C]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13" />
                  </svg>
                  {t('btn_discard')}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isActiveDirty}
                  className="inline-flex items-center gap-2 rounded-[12px] bg-[#C49A1E] px-5 py-2 text-[12.5px] font-black text-[#0C1209] transition-all hover:bg-[#B08A14] hover:shadow-[0_10px_20px_rgba(196,154,30,0.25)] disabled:cursor-not-allowed disabled:opacity-50 dark:disabled:opacity-40"
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

            {pageLoading ? (
              <div className="flex flex-1 items-center justify-center rounded-[18px] border border-[#E1DBCF] bg-white p-12 dark:border-[#1E2E18] dark:bg-[#0E170C]">
                <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
              </div>
            ) : pageError ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[18px] border border-red-200 bg-red-50 p-12 text-center dark:border-red-900/40 dark:bg-red-950/30">
                <p className="text-[13px] font-semibold text-red-600 dark:text-red-300">{t('load_error')}</p>
                <button type="button" onClick={() => loadPage(activePage)}
                  className="rounded-xl border border-[#C49A1E]/40 px-4 py-2 text-[12.5px] font-bold text-[#C49A1E] hover:bg-[#C49A1E]/8 transition-colors">
                  {t('btn_retry')}
                </button>
              </div>
            ) : (
              <LegalEditor
                pageKey={activePage}
                html={activeContent}
                onChange={handleChange}
                disabled={saving}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
