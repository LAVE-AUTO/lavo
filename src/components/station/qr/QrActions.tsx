'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  renderBrandedQrPosterToDataUrl,
  QR_COLOR_DARK,
  QR_COLOR_LIGHT,
  QR_LOGO_SRC,
} from './qr-with-logo';
import QRCode from 'qrcode';

interface Props {
  url: string;
  stationName: string;
}

// Sanitize a station name for use in a filename - removes path-traversal chars and limits length
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .slice(0, 50) || 'station';
}

export function QrActions({ url, stationName }: Props) {
  const t = useTranslations('station_qr');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  /* Download as PNG — branded poster (wordmark + station name + caption) */
  const downloadPng = useCallback(async () => {
    const dataUrl = await renderBrandedQrPosterToDataUrl(url, {
      stationName,
      caption: t('poster_caption'),
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${sanitizeFilename(stationName)}.png`;
    a.click();
  }, [url, stationName, t]);

  /* Download as SVG (logo embedded as a base64 <image>) */
  const downloadSvg = useCallback(async () => {
    const baseSvg = await QRCode.toString(url, {
      type: 'svg',
      width: 1024,
      margin: 2,
      color: { dark: QR_COLOR_DARK, light: QR_COLOR_LIGHT },
      errorCorrectionLevel: 'H',
    });
    const logoDataUrl = await fetch(QR_LOGO_SRC)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => null);
    let finalSvg = baseSvg;
    if (logoDataUrl) {
      const viewBoxMatch = baseSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
      const vbSize = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 1024;
      const logoW = vbSize * 0.26;
      const pad = vbSize * 0.025;
      const radius = vbSize * 0.04;
      const tmp = new Image();
      const aspect = await new Promise<number>((resolve) => {
        tmp.onload = () => resolve(tmp.naturalWidth / tmp.naturalHeight);
        tmp.onerror = () => resolve(2.48);
        tmp.src = logoDataUrl;
      });
      const logoH = logoW / aspect;
      const bgW = logoW + pad * 2;
      const bgH = logoH + pad * 2;
      const bgX = (vbSize - bgW) / 2;
      const bgY = (vbSize - bgH) / 2;
      const overlay =
        `<rect x="${bgX}" y="${bgY}" width="${bgW}" height="${bgH}" rx="${radius}" ry="${radius}" fill="${QR_COLOR_LIGHT}"/>` +
        `<image href="${logoDataUrl}" x="${bgX + pad}" y="${bgY + pad}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>`;
      finalSvg = baseSvg.replace(/<\/svg>\s*$/, `${overlay}</svg>`);
    }
    const blob = new Blob([finalSvg], { type: 'image/svg+xml' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `qr-${sanitizeFilename(stationName)}.svg`;
    a.click();
    // Delay revoke to let the browser finish reading the blob URL
    setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
  }, [url, stationName]);

  /* Copy link */
  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
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
        className={`${btnBase} bg-[#DDAF3B] text-[#001201] hover:opacity-90`}
      >
        <DownloadIcon />
        {t('download_png')}
      </button>

      {/* Secondary row */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={downloadSvg}
          className={`${btnBase} flex-1 border border-[#D8D4C8] text-[#5A5A4A] hover:bg-[#F0EDE4] dark:border-[#001A05] dark:text-[#B0BFB1] dark:hover:bg-[#1A2A14]`}
        >
          <SvgIcon />
          {t('download_svg')}
        </button>
        <button
          type="button"
          onClick={copyLink}
          className={`${btnBase} flex-1 border border-[#D8D4C8] text-[#5A5A4A] hover:bg-[#F0EDE4] dark:border-[#001A05] dark:text-[#B0BFB1] dark:hover:bg-[#1A2A14]`}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? t('link_copied') : copyError ? t('copy_error') : t('copy_link')}
        </button>
      </div>

      {/* Share (only shown if Web Share API is available) */}
      {canShare && (
        <button
          type="button"
          onClick={share}
          className={`${btnBase} border border-[#DDAF3B]/30 text-[#DDAF3B] hover:bg-[#DDAF3B]/10`}
        >
          <ShareIcon />
          {t('share')}
        </button>
      )}
    </div>
  );
}

/* Inline SVG icons - outline style, 16x16 */

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
