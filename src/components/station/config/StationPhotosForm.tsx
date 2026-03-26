'use client';

import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';

const MAX_PHOTOS       = 8;
const UPLOAD_TIMEOUT   = 30_000;
const MAX_SIZE         = 10 * 1024 * 1024;
const ACCEPTED_TYPES   = ['image/jpeg', 'image/png', 'image/webp'];

interface Props { locked?: boolean }

export function StationPhotosForm({ locked = false }: Props) {
  const t          = useTranslations('station_config');
  const { success, error: showError } = useToast();
  const { token }  = useAuth();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const targetSlot    = useRef(0);

  // TODO: connect to API once endpoint is available (GET /station/me or /station/photos)
  // Load existing photo URLs on mount and populate the photos state.
  const [photos,       setPhotos]       = useState<string[]>(Array(MAX_PHOTOS).fill(''));
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [isDirty,      setIsDirty]      = useState(false);

  function triggerUpload(slot: number) {
    if (locked || uploadingIdx !== null) return;
    targetSlot.current = slot;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const slot = targetSlot.current;

    if (!ACCEPTED_TYPES.includes(file.type)) { showError(t('photos_error_type')); return; }
    if (file.size > MAX_SIZE)                 { showError(t('photos_error_size')); return; }

    setUploadingIdx(slot);
    const form = new FormData();
    form.append('file', file);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);
    try {
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/v1/upload', {
        method: 'POST', body: form, credentials: 'include', signal: controller.signal,
        headers,
      });
      clearTimeout(timer);
      if (!mountedRef.current) return;
      if (!res.ok) { showError(t('photos_error_upload')); return; }
      const body = await res.json();
      const url  = body?.data?.url as string | undefined;
      if (!url) { showError(t('photos_error_upload')); return; }
      setPhotos(prev => { const n = [...prev]; n[slot] = url; return n; });
      setIsDirty(true);
    } catch {
      clearTimeout(timer);
      if (mountedRef.current) showError(t('photos_error_upload'));
    } finally {
      if (mountedRef.current) setUploadingIdx(null);
    }
  }

  function handleDelete(slot: number) {
    setPhotos(prev => { const n = [...prev]; n[slot] = ''; return n; });
    setIsDirty(true);
  }

  async function handleSave() {
    // TODO: connect to API once endpoint is available (PATCH /station/photos)
    // Payload: { photo_urls: photos.filter(Boolean) }
    // Backend must: store URLs linked to the station record.
    //   Return them in GET /stations/:id so client-facing cards can display them.
    // Save is a no-op until the endpoint exists — do not show a success toast for a mocked call.
    showError(t('photos_save_unavailable'));
  }

  return (
    <div className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
      <div className="border-b border-[#F0EDE0] px-6 py-4 dark:border-[#1E2E18]">
        <p className="text-[12px] font-black uppercase tracking-wider text-[#1A1A0A] dark:text-[#F0EDD4]">{t('section_photos')}</p>
        <p className="mt-0.5 text-[11px] text-[#AAAAAA] dark:text-[#4A4A3A]">{t('section_photos_hint')}</p>
      </div>

      <div className="p-6">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} aria-hidden="true" tabIndex={-1} />

        <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 md:grid-cols-8">
          {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
            const url        = photos[i];
            const isUploading = uploadingIdx === i;
            const isEmpty    = !url && !isUploading;
            return (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
                {url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={t('photos_slot_aria', { n: i + 1 })} className="h-full w-full object-cover" />
                    {!locked && (
                      <button type="button" onClick={() => handleDelete(i)}
                        aria-label={t('photos_delete_aria')}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/40 [&:hover>svg]:opacity-100">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-0 transition-opacity" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </>
                ) : (
                  <button type="button" disabled={locked || uploadingIdx !== null} onClick={() => triggerUpload(i)}
                    aria-label={t('photos_slot_aria', { n: i + 1 })}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#D8D4C8] bg-[#F8F6F2] transition-colors hover:border-[#C49A1E] hover:bg-[#FFFBF0] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#243020] dark:bg-[#0F1A0C] dark:hover:border-[#C49A1E] dark:hover:bg-[#141E10]">
                    {isUploading ? (
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2.5" aria-hidden="true">
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isEmpty ? '#C8C4B4' : '#C49A1E'} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span className="text-[9px] font-semibold text-[#BBBBAA] dark:text-[#3A3A2A]">{t('photos_add')}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {isDirty && (
          <div className="mt-4 flex flex-col gap-3">
            {/* Preview notice — save not available until PATCH /station/photos endpoint is connected */}
            <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 dark:border-orange-900/40 dark:bg-orange-950/20">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[11px] leading-snug text-orange-700 dark:text-orange-400">{t('photos_save_unavailable')}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#FF8800]">{t('photos_unsaved')}</p>
              {/* Save button disabled — TODO: enable once PATCH /station/photos endpoint is available */}
              <button type="button" onClick={handleSave} disabled
                title={t('photos_save_unavailable')}
                className="flex items-center gap-2 rounded-xl bg-[#C49A1E] px-5 py-2.5 text-[13px] font-bold text-[#0C1209] opacity-40 cursor-not-allowed">
                {t('btn_save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
