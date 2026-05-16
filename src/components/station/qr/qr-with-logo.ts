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
