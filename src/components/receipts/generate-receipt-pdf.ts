/**
 * Branded client receipt PDF, generated in the browser with jsPDF.
 *
 * One shared generator for both entry points:
 *   - the post-booking success screen (BookingReceipt)
 *   - the history / reservation-detail receipt modal (ReceiptModal)
 *
 * Produces a real downloaded file (no print dialog), with the Hurryline
 * wordmark, station block, fiscal lines from the backend snapshot and an
 * optional ticket code.
 */
import { jsPDF } from 'jspdf';

export interface ReceiptPdfLine {
  label: string;
  amount: string;
  /** Secondary line under the label (vehicle format, entry type...). */
  sub?: string;
  /** Muted styling for fiscal/derived lines. */
  secondary?: boolean;
}

export interface ReceiptPdfData {
  /** Localized document title (e.g. "Reçu"). */
  title: string;
  /** Reference shown in the meta bar (e.g. "#A1B2C3D4"). */
  reference: string;
  /** Localized date string. */
  dateLabel: string;
  stationName: string;
  stationAddress: string;
  lines: ReceiptPdfLine[];
  totalLabel: string;
  totalAmount: string;
  /** Optional line under the total (e.g. separate tip). */
  totalNote?: string | null;
  /** Optional ticket code block. */
  ticketLabel?: string | null;
  ticketCode?: string | null;
  ticketHint?: string | null;
  footer: string;
  /** Filename without extension. */
  fileName: string;
  /** 'fr' | 'en' — picks the localized wordmark asset. */
  locale: string;
}

/** Loads a public asset as a data URL for embedding into the PDF. */
async function loadImageDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const GOLD: [number, number, number] = [221, 175, 59];
const DARK: [number, number, number] = [0, 18, 1];
const MUTED: [number, number, number] = [130, 135, 125];
const TEXT: [number, number, number] = [17, 23, 17];
const LINE: [number, number, number] = [228, 228, 216];

/**
 * Builds and saves the receipt PDF. Throws on unexpected jsPDF failures so
 * callers can fall back to the legacy print window.
 */
export async function generateReceiptPdf(data: ReceiptPdfData): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const innerW = pageW - margin * 2;

  /* ── Header band: dark background + wordmark (dark-bg variant) ── */
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 34, 'F');

  const logoPath = data.locale === 'en' ? '/logo/logo_anglais_2.png' : '/logo/logo22_2.png';
  const logo = await loadImageDataUrl(logoPath);
  if (logo) {
    /* Wordmark keeps its aspect ratio inside a 12mm-tall box. */
    try {
      const props = doc.getImageProperties(logo);
      const h = 12;
      const w = (props.width / props.height) * h;
      doc.addImage(logo, 'PNG', margin, 11, Math.min(w, 70), h);
    } catch {
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('HURRYLINE', margin, 21);
    }
  } else {
    doc.setTextColor(...GOLD);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('HURRYLINE', margin, 21);
  }

  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(data.title.toUpperCase(), pageW - margin, 19, { align: 'right' });
  doc.setTextColor(176, 191, 177);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('hurryline.com', pageW - margin, 24, { align: 'right' });

  /* ── Meta bar ── */
  let y = 44;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'bold');
  doc.text(data.reference, margin, y);
  doc.text(data.dateLabel, pageW - margin, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);

  /* ── Station block ── */
  y += 9;
  doc.setTextColor(...GOLD);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(data.stationName ? data.stationName.toUpperCase() : '', margin, y);
  y += 5;
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const addressLines = doc.splitTextToSize(data.stationAddress, innerW);
  doc.text(addressLines, margin, y);
  y += addressLines.length * 5 + 4;
  doc.setDrawColor(...LINE);
  doc.line(margin, y, pageW - margin, y);

  /* ── Lines ── */
  y += 8;
  for (const line of data.lines) {
    doc.setFont('helvetica', line.secondary ? 'normal' : 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...(line.secondary ? MUTED : TEXT));
    doc.text(line.label, margin, y);
    doc.setFont('courier', 'bold');
    doc.setTextColor(...TEXT);
    doc.text(line.amount, pageW - margin, y, { align: 'right' });
    if (line.sub) {
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(line.sub, margin, y);
    }
    y += 7;
  }

  /* ── Total block ── */
  y += 2;
  doc.setFillColor(...DARK);
  doc.roundedRect(margin, y, innerW, 16, 2.5, 2.5, 'F');
  doc.setTextColor(176, 191, 177);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(data.totalLabel.toUpperCase(), margin + 6, y + 10);
  doc.setTextColor(...GOLD);
  doc.setFontSize(16);
  doc.text(data.totalAmount, pageW - margin - 6, y + 10.5, { align: 'right' });
  y += 22;

  if (data.totalNote) {
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(data.totalNote, pageW - margin, y, { align: 'right' });
    y += 7;
  }

  /* ── Ticket code block ── */
  if (data.ticketCode && data.ticketLabel) {
    y += 2;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, innerW, 26, 2.5, 2.5, 'S');
    doc.setTextColor(...GOLD);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(data.ticketLabel.toUpperCase(), margin + 6, y + 7);
    doc.setTextColor(...TEXT);
    doc.setFont('courier', 'bold');
    doc.setFontSize(20);
    doc.text(data.ticketCode.split('').join(' '), margin + 6, y + 17);
    if (data.ticketHint) {
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const hintLines = doc.splitTextToSize(data.ticketHint, innerW - 12);
      doc.text(hintLines, margin + 6, y + 22);
    }
    y += 34;
  }

  /* ── Footer ── */
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 24, pageW - margin, pageH - 24);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(data.footer, pageW / 2, pageH - 17, { align: 'center' });
  doc.text('Hurryline inc. - hurryline.com', pageW / 2, pageH - 12, { align: 'center' });

  doc.save(`${data.fileName}.pdf`);
}
