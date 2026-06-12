'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

/* Brand-coloured social glyphs (single-path, currentColor where possible). */
function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.8a8.1 8.1 0 0 1 5.76 13.83 8.1 8.1 0 0 1-9.99 1.18l-.36-.21-3.11.82.83-3.03-.23-.38a8.1 8.1 0 0 1 7.1-12.02Zm-2.4 4.04c-.18 0-.46.07-.7.34-.24.27-.92.9-.92 2.2s.94 2.55 1.07 2.73c.13.18 1.85 2.82 4.48 3.96.62.27 1.11.43 1.49.55.63.2 1.2.17 1.65.1.5-.07 1.54-.63 1.76-1.24.22-.61.22-1.13.15-1.24-.06-.11-.24-.18-.51-.31-.27-.13-1.61-.79-1.86-.88-.25-.09-.43-.13-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.34-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.41.12-.55.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.34-.02-.47-.07-.13-.6-1.48-.84-2.02-.2-.46-.4-.4-.55-.41h-.47Z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22c4.78-.76 8.43-4.92 8.43-9.94Z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.22-6.82-5.97 6.82H1.66l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64Z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
    </svg>
  );
}
function ShareGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Copies `text` to the clipboard with a legacy fallback for non-secure contexts. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Share menu used in the public navbar.
 * `inline` renders the 4 social buttons in a row (mobile drawer); otherwise it
 * renders a "Partager" trigger that toggles a dropdown.
 */
export function ShareMenu({ inline = false }: { inline?: boolean }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setUrl(`${window.location.origin}/${locale}`);
  }, [locale]);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  async function handleCopy() {
    const ok = await copyToClipboard(url);
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const message = t('share_message');
  const enc = encodeURIComponent;
  const links = [
    { key: 'whatsapp', label: t('share_whatsapp'), color: '#25D366', icon: <WhatsAppIcon />, href: `https://wa.me/?text=${enc(`${message} ${url}`)}` },
    { key: 'facebook', label: t('share_facebook'), color: '#1877F2', icon: <FacebookIcon />, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { key: 'x',        label: t('share_x'),        color: '#000000', icon: <XIcon />,        href: `https://twitter.com/intent/tweet?text=${enc(message)}&url=${enc(url)}` },
    { key: 'email',    label: t('share_email'),    color: '#DDAF3B', icon: <MailIcon />,     href: `mailto:?subject=${enc(t('share_email_subject'))}&body=${enc(`${message} ${url}`)}` },
  ];

  if (inline) {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-4 gap-2">
          {links.map(({ key, label, color, icon, href }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex flex-col items-center justify-center gap-1 rounded-md border border-[rgba(221,175,59,0.25)] py-2.5 text-[11px] font-semibold text-[var(--foreground)] transition-colors hover:border-[#DDAF3B] hover:text-[#DDAF3B] dark:text-[#B0BFB1]"
            >
              <span style={{ color }}>{icon}</span>
              {label}
            </a>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t('share_copy')}
          className="flex items-center justify-center gap-2 rounded-md border border-[rgba(221,175,59,0.25)] py-2.5 text-[12px] font-semibold text-[var(--foreground)] transition-colors hover:border-[#DDAF3B] hover:text-[#DDAF3B] dark:text-[#B0BFB1]"
        >
          <span className={copied ? 'text-[#2ECC71]' : 'text-[#DDAF3B]'}>{copied ? <CheckIcon /> : <CopyIcon />}</span>
          {copied ? t('share_copied') : t('share_copy')}
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('share_aria')}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex h-[34px] items-center gap-1.5 rounded-full border border-[rgba(221,175,59,0.45)] px-3 text-[12px] font-semibold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B] hover:text-[#001201]"
      >
        <ShareGlyph />
        {t('share')}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[200px] overflow-hidden rounded-[8px] border border-[rgba(221,175,59,0.2)] bg-[#FFEECA] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.2)] animate-fade-in dark:bg-dark-bg">
          {links.map(({ key, label, color, icon, href }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[rgba(221,175,59,0.1)] hover:text-[#DDAF3B] dark:text-[#B0BFB1]"
            >
              <span style={{ color }}>{icon}</span>
              {label}
            </a>
          ))}
          <button
            type="button"
            onClick={handleCopy}
            className="mt-1 flex w-full items-center gap-3 rounded-md border-t border-[rgba(221,175,59,0.12)] px-3 py-2.5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[rgba(221,175,59,0.1)] hover:text-[#DDAF3B] dark:text-[#B0BFB1]"
          >
            <span className={copied ? 'text-[#2ECC71]' : 'text-[#DDAF3B]'}>{copied ? <CheckIcon /> : <CopyIcon />}</span>
            {copied ? t('share_copied') : t('share_copy')}
          </button>
        </div>
      )}
    </div>
  );
}
