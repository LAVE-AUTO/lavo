'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';

export interface UploadedDoc {
  url: string;
  storage: string;
  name: string;
}

interface Props {
  label: string;
  hint: string;
  required?: boolean;
  value: UploadedDoc | null;
  onChange: (file: UploadedDoc | null) => void;
  error?: string;
}

const ACCEPTED_MIME      = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES          = 10 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS  = 30_000;

export function AdminDocUpload({ label, hint, required, value, onChange, error }: Props) {
  const t = useTranslations('admin_add_station');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localError,  setLocalError]  = useState<string | null>(null);

  const displayError = error || localError;

  async function handleFile(file: File) {
    setLocalError(null);
    if (!ACCEPTED_MIME.includes(file.type)) { setLocalError(t('doc_error_format')); return; }
    if (file.size > MAX_BYTES) { setLocalError(t('doc_error_size')); return; }

    setIsUploading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/stations/onboarding/upload', {
        method: 'POST', body: formData, credentials: 'include', signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const body = await res.json() as { data: { url: string; storage: string } };
        onChange({ url: body.data.url, storage: body.data.storage, name: file.name });
      } else {
        setLocalError(t('doc_error_upload'));
      }
    } catch {
      clearTimeout(timer);
      setLocalError(t('doc_error_upload'));
    } finally {
      setIsUploading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[13px] font-bold text-foreground/70 dark:text-[#B0BFB1]">
        {label}
        {required && <span className="ml-0.5 text-[#DDAF3B]">*</span>}
        {hint && <span className="ml-1 font-normal text-foreground/55 dark:text-[#B0BFB1]">- {hint}</span>}
      </p>

      {value ? (
        <div className="flex items-center justify-between rounded-lg border border-[#00C851]/25 bg-[#00C851]/6 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="truncate text-[12px] font-semibold text-[#001201] dark:text-[#FFF9EC]">{value.name}</span>
          </div>
          <button type="button" onClick={() => { onChange(null); setLocalError(null); }} disabled={isUploading}
            className="ml-2 shrink-0 text-[12px] font-bold text-foreground/55 transition-colors hover:text-red-500 disabled:opacity-40">
            {t('doc_file_remove')}
          </button>
        </div>
      ) : (
        <div
          onDrop={isUploading ? undefined : onDrop}
          onDragOver={isUploading ? undefined : (e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={isUploading ? undefined : () => setIsDragging(false)}
          onClick={isUploading ? undefined : () => inputRef.current?.click()}
          className={[
            'flex flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed px-4 py-4 transition-all',
            isUploading ? 'cursor-default' : 'cursor-pointer',
            isDragging          ? 'border-[#DDAF3B] bg-[#DDAF3B]/6' : '',
            displayError        ? 'border-red-400' : '',
            !isDragging && !displayError ? 'border-[#D8D4C8] hover:border-[#DDAF3B]/60 dark:border-[#001A05]' : '',
          ].join(' ')}
        >
          {isUploading ? (
            <p className="text-[13px] text-foreground/55 dark:text-[#B0BFB1]">{t('doc_uploading')}</p>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BBBBAA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{t('doc_drop_or_click')}</p>
            </>
          )}
          <input ref={inputRef} type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        </div>
      )}

      {displayError && <p className="mt-1 text-[12px] font-semibold text-red-500">{displayError}</p>}
    </div>
  );
}
