'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { LegalEditor } from './legal/LegalEditor';

type PageKey = 'privacy' | 'terms_clients' | 'terms_stations' | 'legal_mentions' | 'contact' | 'how_it_works';

const PAGES: { key: PageKey; labelKey: string }[] = [
  { key: 'privacy',        labelKey: 'page_privacy' },
  { key: 'terms_clients',  labelKey: 'page_terms_clients' },
  { key: 'terms_stations', labelKey: 'page_terms_stations' },
  { key: 'legal_mentions', labelKey: 'page_legal_mentions' },
  { key: 'contact',        labelKey: 'page_contact' },
  { key: 'how_it_works',   labelKey: 'page_how_it_works' },
];

// TODO: connect to API once endpoint is available (GET /admin/legal-content)
// Fetch each page's HTML content on mount; replace these defaults.
const INITIAL: Record<PageKey, string> = {
  privacy:        '<h2>Politique de confidentialité</h2><p>Veuillez rédiger votre politique de confidentialité ici.</p>',
  terms_clients:  '<h2>Conditions générales d\'utilisation — Clients</h2><p>Veuillez rédiger les CGU clients ici.</p>',
  terms_stations: '<h2>Conditions générales d\'utilisation — Stations</h2><p>Veuillez rédiger les CGU stations ici.</p>',
  legal_mentions: '<h2>Mentions légales</h2><p>Veuillez rédiger les mentions légales ici.</p>',
  contact:        '<h2>Contact</h2><p>Veuillez rédiger les informations de contact ici.</p>',
  how_it_works:   '<h2>Comment ça marche</h2><p>Veuillez décrire le fonctionnement de la plateforme ici.</p>',
};

export function AdminLegalContent() {
  const t                    = useTranslations('admin_legal');
  const { success, error: showError } = useToast();
  const mountedRef           = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [activePage, setActivePage] = useState<PageKey>('privacy');
  const [contents,   setContents]   = useState<Record<PageKey, string>>({ ...INITIAL });
  const [dirty,      setDirty]      = useState<Set<PageKey>>(new Set());
  const [saving,     setSaving]     = useState(false);

  function handleChange(html: string) {
    setContents(prev => ({ ...prev, [activePage]: html }));
    setDirty(prev => { const s = new Set(prev); s.add(activePage); return s; });
  }

  async function handleSave() {
    setSaving(true);
    try {
      // TODO: connect to API once endpoint is available (POST /admin/legal-content/:key)
      // Payload: { key: activePage, html: contents[activePage] }
      // Backend must: store content per key, serve it on the corresponding public page.
      // Keys map to public routes: privacy → /privacy-policy, terms_clients → /terms/clients,
      //   terms_stations → /terms/stations, legal_mentions → /legal, contact → /contact,
      //   how_it_works → landing page "Comment ça marche" section.
      // TODO: sanitize HTML server-side (DOMPurify or equivalent) before persisting and before
      //   rendering on public pages — raw WYSIWYG output is an XSS risk if admin credentials are compromised.
      await new Promise<void>(r => setTimeout(r, 600));
      if (!mountedRef.current) return;
      setDirty(prev => { const s = new Set(prev); s.delete(activePage); return s; });
      success(t('save_success'));
    } catch {
      if (mountedRef.current) showError(t('save_error'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  const pageBtn = (key: PageKey) => [
    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition-colors',
    activePage === key
      ? 'bg-[#C49A1E] text-[#0C1209]'
      : 'text-[#555] hover:bg-[#E8E4D8] dark:text-[#9A9A8A] dark:hover:bg-[#182214]',
  ].join(' ');

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
              <span>{t(labelKey)}</span>
              {dirty.has(key) && (
                <span className={`h-2 w-2 shrink-0 rounded-full ${activePage === key ? 'bg-[#0C1209]/40' : 'bg-[#C49A1E]'}`} aria-label={t('unsaved_indicator')} />
              )}
            </button>
          ))}
        </div>

        {/* Editor panel */}
        <div className="flex flex-1 flex-col gap-3">
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
        </div>
      </div>
    </div>
  );
}
