'use client';

import { useRef, useLayoutEffect } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  pageKey: string;
  html:    string;
  onChange: (html: string) => void;
  disabled?: boolean;
}

export function LegalEditor({ pageKey, html, onChange, disabled = false }: Props) {
  const t         = useTranslations('admin_legal');
  const editorRef = useRef<HTMLDivElement>(null);

  // Synchronously set content on page switch (avoids blank flash)
  useLayoutEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = html;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]); // intentionally only on page change — not on every html update

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    try { document.execCommand(cmd, false, value); } catch { /* execCommand can throw in certain environments */ }
  }

  const btn = [
    'px-2 py-1 text-[11px] rounded transition-colors',
    'text-[#555] hover:bg-[#E8E4DC] dark:text-[#9A9A8A] dark:hover:bg-[#243020]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' ');

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#E0DCD0] dark:border-[#243020]">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#E0DCD0] bg-[#F8F6F0] px-2 py-1.5 dark:border-[#243020] dark:bg-[#141E10]">
        <button type="button" disabled={disabled} onClick={() => exec('bold')}
          className={`${btn} font-bold`} aria-label={t('toolbar_bold')}>B</button>
        <button type="button" disabled={disabled} onClick={() => exec('italic')}
          className={`${btn} italic`} aria-label={t('toolbar_italic')}>I</button>
        <button type="button" disabled={disabled} onClick={() => exec('underline')}
          className={`${btn} underline decoration-1`} aria-label={t('toolbar_underline')}>U</button>

        <div className="mx-1.5 h-4 w-px bg-[#D8D4C8] dark:bg-[#2A3826]" aria-hidden="true" />

        <button type="button" disabled={disabled} onClick={() => exec('formatBlock', 'h2')}
          className={`${btn} font-semibold`} aria-label="H2">H2</button>
        <button type="button" disabled={disabled} onClick={() => exec('formatBlock', 'h3')}
          className={btn} aria-label="H3">H3</button>
        <button type="button" disabled={disabled} onClick={() => exec('formatBlock', 'p')}
          className={btn} aria-label={t('toolbar_paragraph')} title={t('toolbar_paragraph')}>¶</button>

        <div className="mx-1.5 h-4 w-px bg-[#D8D4C8] dark:bg-[#2A3826]" aria-hidden="true" />

        <button type="button" disabled={disabled} onClick={() => exec('insertUnorderedList')}
          className={btn} aria-label={t('toolbar_ul')}>• —</button>
        <button type="button" disabled={disabled} onClick={() => exec('insertOrderedList')}
          className={btn} aria-label={t('toolbar_ol')}>1.</button>
      </div>

      {/* Editable area — key forces remount on page change so cursor/state is reset */}
      <div
        key={pageKey}
        ref={editorRef}
        role="textbox"
        aria-label={t('editor_aria_label')}
        aria-multiline="true"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        className={[
          'min-h-[420px] overflow-y-auto p-4 text-[13px] leading-relaxed outline-none',
          'text-[#1A1A0A] dark:text-[#F0EDD4]',
          disabled ? 'cursor-not-allowed opacity-60' : '',
          '[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-[16px] [&_h2]:font-bold',
          '[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-[14px] [&_h3]:font-semibold',
          '[&_ul]:mb-2 [&_ul]:ml-5 [&_ul]:list-disc',
          '[&_ol]:mb-2 [&_ol]:ml-5 [&_ol]:list-decimal',
          '[&_p]:mb-2',
          '[&_a]:text-[#C49A1E] [&_a]:underline',
        ].join(' ')}
      />
    </div>
  );
}
