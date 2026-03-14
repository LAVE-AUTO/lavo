'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';

export interface UploadedFile {
  url: string;
  storage: 'cloudinary' | 'local';
  name: string;
}

interface FileUploadZoneProps {
  label: string;
  hint: string;
  required?: boolean;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  error?: string;
}

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Single-file drag-and-drop upload zone for station onboarding documents.
 * Uploads to POST /stations/onboarding/upload and returns { url, storage }.
 */
export function FileUploadZone({ label, hint, required, value, onChange, error }: FileUploadZoneProps) {
  const t = useTranslations('station_apply');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = error || localError;

  async function handleFile(file: File) {
    setLocalError(null);

    if (!ACCEPTED_MIME.includes(file.type)) {
      setLocalError(t('error_file_format'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError(t('error_file_size'));
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use fetch directly — axios default Content-Type: application/json
      // would override the multipart boundary for FormData.
      const response = await fetch('/api/v1/stations/onboarding/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json() as { url: string; storage: string };
        onChange({ url: data.url, storage: data.storage as 'cloudinary' | 'local', name: file.name });
      } else {
        setLocalError(t('error_upload_failed'));
      }
    } catch {
      setLocalError(t('error_upload_failed'));
    } finally {
      setIsUploading(false);
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  return (
    <div className="mb-5">
      <p className="text-[15px] font-semibold text-[#1A1A1A] dark:text-white mb-1.5 tracking-wide">
        {label}
        {required && <span className="text-gold ml-0.5">*</span>}
      </p>
      <p className="text-[13px] text-[#888] dark:text-lavo-muted mb-2">{hint}</p>

      {value ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-lavo-success/5 border border-lavo-success/30 rounded-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="flex-1 text-[14px] text-[#1A1A1A] dark:text-white truncate">{value.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[13px] font-semibold text-lavo-error hover:text-[#C03010] transition-colors shrink-0"
          >
            {t('file_remove')}
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !isUploading && inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          aria-label={label}
          className={[
            'flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-150',
            isDragging
              ? 'border-gold bg-gold/5'
              : displayError
              ? 'border-lavo-error bg-[#FFF8F7] dark:bg-[#2A1A18]'
              : 'border-[#CCCCCC] dark:border-[#2A3826] hover:border-gold dark:hover:border-gold bg-white dark:bg-dark-card',
          ].join(' ')}
        >
          {isUploading ? (
            <>
              <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span className="text-[14px] text-[#888] dark:text-lavo-muted">{t('uploading')}</span>
            </>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-[14px] text-[#888] dark:text-lavo-muted text-center px-4">{t('drop_or_click')}</span>
            </>
          )}
        </div>
      )}

      {displayError && (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-lavo-error flex items-center gap-1">
          <span aria-hidden="true">!</span>
          {displayError}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
        onChange={handleInputChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
