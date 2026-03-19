'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';

interface Props {
  url: string;
  stationName: string;
}

export function QrActions({ url, stationName }: Props) {
  const t = useTranslations('station_qr');
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  /* Download as PNG */
  const downloadPng = useCallback(async () => {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 1024,
      margin: 2,
      color: { dark: '#1A1A0A', light: '#FFFFFF' },
      errorCorrectionLevel: 'H',
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${stationName.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  }, [url, stationName]);

  /* Download as SVG */
  const downloadSvg = useCallback(async () => {
    const svgStr = await QRCode.toString(url, {
      type: 'svg',
      width: 1024,
      margin: 2,
      color: { dark: '#1A1A0A', light: '#FFFFFF' },
      errorCorrectionLevel: 'H',
    });
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${stationName.replace(/\s+/g, '-').toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [url, stationName]);

  /* Copy link */
  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [url]);

  /* Share (Web Share API if available) */
  const share = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('share_title', { name: stationName }),
          text: t('share_text', { name: stationName }),
          url,
        });
      } catch {
        /* user cancelled */
      }
    }
  }, [url, stationName, t]);

  const btnBase =
    'flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold transition-all';

  return (
    <div className="mt-5 flex flex-col gap-2.5">
      {/* Primary: Download PNG */}
      <button
        type="button"
        onClick={downloadPng}
        className={`${btnBase} bg-[#C49A1E] text-[#0C1209] hover:opacity-90`}
      >
        <DownloadIcon />
        {t('download_png')}
      </button>

      {/* Secondary row */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={downloadSvg}
          className={`${btnBase} flex-1 border border-[#D8D4C8] text-[#5A5A4A] hover:bg-[#F0EDE4] dark:border-[#243020] dark:text-[#9A9A8A] dark:hover:bg-[#1A2A14]`}
        >
          <SvgIcon />
          {t('download_svg')}
        </button>
        <button
          type="button"
          onClick={copyLink}
          className={`${btnBase} flex-1 border border-[#D8D4C8] text-[#5A5A4A] hover:bg-[#F0EDE4] dark:border-[#243020] dark:text-[#9A9A8A] dark:hover:bg-[#1A2A14]`}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? t('link_copied') : t('copy_link')}
        </button>
      </div>

      {/* Share (only shown if Web Share API is available) */}
      {canShare && (
        <button
          type="button"
          onClick={share}
          className={`${btnBase} border border-[#C49A1E]/30 text-[#C49A1E] hover:bg-[#C49A1E]/10`}
        >
          <ShareIcon />
          {t('share')}
        </button>
      )}
    </div>
  );
}

/* Inline SVG icons — outline style, 16x16 */

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const SvgIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
