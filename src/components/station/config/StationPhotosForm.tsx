'use client';

import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { getFromApi, patchWithApi } from '@/services';

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

  const [photos,       setPhotos]       = useState<string[]>(Array(MAX_PHOTOS).fill(''));
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [isDirty,      setIsDirty]      = useState(false);

  useEffect(() => {
    let active = true;

    getFromApi('/station/me').then(([ok, data]) => {
      if (!mountedRef.current || !active || !ok) return;
      const fromApi = (data as { data?: { photos?: string[] } })?.data?.photos ?? [];
      const next = Array(MAX_PHOTOS).fill('').map((_, i) => fromApi[i] ?? '');
      setPhotos(next);
      setIsDirty(false);
    });

    return () => {
      active = false;
    };
  }, []);

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
    const photoPayload = photos
      .map((url, i) => ({ url, position: i }))
      .filter((p) => Boolean(p.url));

    const [ok, data] = await patchWithApi('/station/photos', {
      photos: photoPayload,
    });

    if (!mountedRef.current) return;

    if (ok) {
      const saved = (data as { data?: { photos?: string[] } })?.data?.photos ?? photos.filter(Boolean);
      const next = Array(MAX_PHOTOS).fill('').map((_, i) => saved[i] ?? '');
      setPhotos(next);
      setIsDirty(false);
      success(t('photos_save_success'));
      return;
    }

    showError(t('photos_save_error'));
  }

  return (
    <div className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[#001A05] dark:ring-white/[0.06]">
      <div className="border-b border-[#F0EDE0] px-6 py-4 dark:border-[#1E2E18]">
        <p className="text-[13px] font-black uppercase tracking-wider text-[#001201] dark:text-[#FFF9EC]">{t('section_photos')}</p>
        <p className="mt-0.5 text-[12px] text-[#AAAAAA] dark:text-[#4A4A3A]">{t('section_photos_hint')}</p>
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
                    {/* Delete disabled during active upload to prevent race condition */}
                    {!locked && (
                      <button type="button" onClick={() => handleDelete(i)} disabled={uploadingIdx !== null}
                        aria-label={t('photos_delete_aria')}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/40 [&:hover>svg]:opacity-100 disabled:cursor-not-allowed">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-0 transition-opacity" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </>
                ) : (
                  <button type="button" disabled={locked || uploadingIdx !== null} onClick={() => triggerUpload(i)}
                    aria-label={t('photos_slot_aria', { n: i + 1 })}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#D8D4C8] bg-[#F8F6F2] transition-colors hover:border-[#DDAF3B] hover:bg-[#FFFBF0] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#001A05] dark:bg-[#001201] dark:hover:border-[#DDAF3B] dark:hover:bg-[#141E10]">
                    {isUploading ? (
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2.5" aria-hidden="true">
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isEmpty ? '#C8C4B4' : '#DDAF3B'} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
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
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[#FF8800]">{t('photos_unsaved')}</p>
            <button type="button" onClick={handleSave} disabled={locked || uploadingIdx !== null}
              className="flex items-center gap-2 rounded-xl bg-[#DDAF3B] px-5 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed">
              {t('btn_save')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
