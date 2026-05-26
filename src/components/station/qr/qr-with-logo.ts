import QRCode from 'qrcode';

export const QR_COLOR_DARK = '#0C1209';
export const QR_COLOR_LIGHT = '#FFFFFF';
/* The square hourglass icon reads better at small sizes than the full
 * wordmark, and stays balanced inside the centered white badge. */
export const QR_LOGO_SRC = '/logo/frame2.png';

/* Logo footprint as a ratio of the QR size. errorCorrectionLevel "H"
 * recovers up to 30% of the code; we stay at ~28% to keep a wide margin
 * for printers and angled scans. */
const LOGO_WIDTH_RATIO = 0.28;
const LOGO_PADDING_RATIO = 0.03;
const LOGO_BG_RADIUS_RATIO = 0.05;

function loadLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = QR_LOGO_SRC;
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function renderQrWithLogo(
  canvas: HTMLCanvasElement,
  url: string,
  size: number,
): Promise<void> {
  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin: 2,
    color: { dark: QR_COLOR_DARK, light: QR_COLOR_LIGHT },
    errorCorrectionLevel: 'H',
  });
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  /* `qrcode` sets the canvas to its rendered size; we read it back so the
   * logo math is in canvas pixel space regardless of CSS scaling. */
  const renderedSize = canvas.width;
  let logo: HTMLImageElement;
  try {
    logo = await loadLogo();
  } catch {
    return;
  }
  const aspect = logo.naturalWidth / logo.naturalHeight;
  const logoW = renderedSize * LOGO_WIDTH_RATIO;
  const logoH = logoW / aspect;
  const padding = renderedSize * LOGO_PADDING_RATIO;
  const bgW = logoW + padding * 2;
  const bgH = logoH + padding * 2;
  const bgX = (renderedSize - bgW) / 2;
  const bgY = (renderedSize - bgH) / 2;
  const radius = renderedSize * LOGO_BG_RADIUS_RATIO;
  ctx.fillStyle = QR_COLOR_LIGHT;
  roundRectPath(ctx, bgX, bgY, bgW, bgH, radius);
  ctx.fill();
  ctx.drawImage(logo, bgX + padding, bgY + padding, logoW, logoH);
  void size;
}

export async function renderQrWithLogoToDataUrl(
  url: string,
  size: number,
): Promise<string> {
  const canvas = document.createElement('canvas');
  await renderQrWithLogo(canvas, url, size);
  return canvas.toDataURL('image/png');
}

/* ─── Branded poster ───────────────────────────────────────────────────────── */

/** Wide wordmark used in the poster header. Sits well above the QR. */
const WORDMARK_SRC = '/logo/logo_2.png';

const POSTER_BRAND_GOLD = '#C49A1E';
const POSTER_TEXT       = '#0C1209';
const POSTER_MUTED      = '#7A6F4A';
const POSTER_BG         = '#FFFFFF';
const POSTER_ACCENT_BG  = '#FBF6E8';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function fittedDpr(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) {
  const canvas = ctx.canvas;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface BrandedQrPosterOptions {
  /** Main title — usually the station name. */
  stationName: string;
  /** One-line caption shown above the QR ("Scannez pour réserver…"). */
  caption?: string;
  /** Optional URL printed under the QR for fallback typing. */
  showUrl?: boolean;
  /** Optional footer tag printed under the QR (e.g. "Promo -10 %"). */
  footerTag?: string;
}

/**
 * Renders a vertical, print-ready poster combining the Hurryline wordmark,
 * the QR with its centered hourglass logo, the station name, and an optional
 * caption / URL / footer tag. Returns a PNG data URL.
 *
 * The output is 1080×1500 logical pixels at DPR 2 (2160×3000 actual pixels).
 */
export async function renderBrandedQrPosterToDataUrl(
  url: string,
  opts: BrandedQrPosterOptions,
): Promise<string> {
  const W = 1080;
  const H = 1500;
  const dpr = 2;
  const QR_SIZE = 720;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  fittedDpr(ctx, W, H, dpr);

  // ── Background card with rounded corners + soft gold border ────────────────
  ctx.fillStyle = POSTER_BG;
  ctx.fillRect(0, 0, W, H);

  // Subtle gold accent strip at the very top
  const accentH = 14;
  ctx.fillStyle = POSTER_BRAND_GOLD;
  ctx.fillRect(0, 0, W, accentH);

  // Soft frame inside (gives the "branded card" feel)
  const frameInset = 36;
  const frameRadius = 32;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(196, 154, 30, 0.18)';
  roundRectPath(ctx, frameInset, accentH + frameInset, W - frameInset * 2, H - accentH - frameInset * 2, frameRadius);
  ctx.stroke();

  // ── Wordmark (top, centered) ──────────────────────────────────────────────
  let wordmark: HTMLImageElement | null = null;
  try { wordmark = await loadImage(WORDMARK_SRC); } catch { /* fallback to text */ }

  const wmTopY = accentH + 72;
  if (wordmark) {
    const wmTargetH = 88;
    const wmAspect = wordmark.naturalWidth / wordmark.naturalHeight;
    const wmW = wmTargetH * wmAspect;
    const wmX = (W - wmW) / 2;
    ctx.drawImage(wordmark, wmX, wmTopY, wmW, wmTargetH);
  } else {
    ctx.fillStyle = POSTER_TEXT;
    ctx.font = '700 56px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('HURRYLINE', W / 2, wmTopY);
  }

  // ── Caption above the QR ───────────────────────────────────────────────────
  const caption = opts.caption ?? 'Scannez pour réserver';
  ctx.fillStyle = POSTER_BRAND_GOLD;
  ctx.font = '700 22px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const captionY = wmTopY + 130;
  const captionLetterSpacing = 2;
  // Manually space-out caption for a "ticker" feel
  const captionUpper = caption.toUpperCase();
  let cx = W / 2 - (ctx.measureText(captionUpper).width + captionLetterSpacing * (captionUpper.length - 1)) / 2;
  for (const ch of captionUpper) {
    ctx.textAlign = 'left';
    ctx.fillText(ch, cx, captionY);
    cx += ctx.measureText(ch).width + captionLetterSpacing;
  }

  // ── QR block (with centered logo) ──────────────────────────────────────────
  const qrCanvas = document.createElement('canvas');
  await renderQrWithLogo(qrCanvas, url, QR_SIZE);

  // Surrounding plate (rounded white-on-cream tile)
  const qrPlatePad = 30;
  const plateW = QR_SIZE + qrPlatePad * 2;
  const plateH = QR_SIZE + qrPlatePad * 2;
  const plateX = (W - plateW) / 2;
  const plateY = captionY + 70;

  ctx.fillStyle = POSTER_ACCENT_BG;
  roundRectPath(ctx, plateX, plateY, plateW, plateH, 32);
  ctx.fill();

  ctx.fillStyle = POSTER_BG;
  roundRectPath(ctx, plateX + 10, plateY + 10, plateW - 20, plateH - 20, 24);
  ctx.fill();

  // QR centered in the plate
  ctx.drawImage(qrCanvas, plateX + qrPlatePad, plateY + qrPlatePad, QR_SIZE, QR_SIZE);

  // ── Corner viewfinder brackets (premium scanner cue) ───────────────────────
  const brackLen = 32;
  const brackThick = 4;
  ctx.strokeStyle = POSTER_BRAND_GOLD;
  ctx.lineWidth = brackThick;
  ctx.lineCap = 'round';
  const brackInset = 4;
  // top-left
  ctx.beginPath();
  ctx.moveTo(plateX + brackInset, plateY + brackInset + brackLen);
  ctx.lineTo(plateX + brackInset, plateY + brackInset);
  ctx.lineTo(plateX + brackInset + brackLen, plateY + brackInset);
  ctx.stroke();
  // top-right
  ctx.beginPath();
  ctx.moveTo(plateX + plateW - brackInset - brackLen, plateY + brackInset);
  ctx.lineTo(plateX + plateW - brackInset, plateY + brackInset);
  ctx.lineTo(plateX + plateW - brackInset, plateY + brackInset + brackLen);
  ctx.stroke();
  // bottom-left
  ctx.beginPath();
  ctx.moveTo(plateX + brackInset, plateY + plateH - brackInset - brackLen);
  ctx.lineTo(plateX + brackInset, plateY + plateH - brackInset);
  ctx.lineTo(plateX + brackInset + brackLen, plateY + plateH - brackInset);
  ctx.stroke();
  // bottom-right
  ctx.beginPath();
  ctx.moveTo(plateX + plateW - brackInset - brackLen, plateY + plateH - brackInset);
  ctx.lineTo(plateX + plateW - brackInset, plateY + plateH - brackInset);
  ctx.lineTo(plateX + plateW - brackInset, plateY + plateH - brackInset - brackLen);
  ctx.stroke();

  // ── Station name (large, just below QR) ────────────────────────────────────
  const nameY = plateY + plateH + 60;
  ctx.fillStyle = POSTER_TEXT;
  ctx.font = '900 44px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const nameLines = wrapLines(ctx, opts.stationName, W - frameInset * 2 - 40);
  let cursorY = nameY;
  for (let i = 0; i < Math.min(2, nameLines.length); i++) {
    ctx.fillText(nameLines[i], W / 2, cursorY);
    cursorY += 52;
  }

  // ── Footer tag (optional, gold pill) ───────────────────────────────────────
  if (opts.footerTag) {
    ctx.font = '700 20px "Helvetica Neue", Arial, sans-serif';
    const tagText = opts.footerTag.toUpperCase();
    const tagW = ctx.measureText(tagText).width + 36;
    const tagH = 38;
    const tagX = (W - tagW) / 2;
    const tagY = cursorY + 12;
    ctx.fillStyle = POSTER_BRAND_GOLD;
    roundRectPath(ctx, tagX, tagY, tagW, tagH, tagH / 2);
    ctx.fill();
    ctx.fillStyle = POSTER_TEXT;
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, W / 2, tagY + tagH / 2 + 1);
    ctx.textBaseline = 'top';
    cursorY = tagY + tagH + 16;
  }

  // ── URL (small, muted) ────────────────────────────────────────────────────
  if (opts.showUrl !== false) {
    ctx.fillStyle = POSTER_MUTED;
    ctx.font = '500 18px "Helvetica Neue", Arial, sans-serif';
    const trimmed = url.length > 64 ? `${url.slice(0, 61)}…` : url;
    const urlY = Math.max(cursorY + 6, H - frameInset - 48);
    ctx.fillText(trimmed, W / 2, urlY);
  }

  return canvas.toDataURL('image/png');
}
