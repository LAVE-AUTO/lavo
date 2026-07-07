import { jsPDF } from 'jspdf';
import type { TxRow, TxStatus } from './AdminTransactionDrawer';

export interface PdfLabels {
  pageTitle: string;
  receiptLabel: string;
  stripeIdLabel: string;
  grossLabel: string;
  commissionLabel: string;
  payoutLabel: string;
  stationLabel: string;
  clientLabel: string;
  typeLabel: string;
  clientTotalLabel: string;
  platformFeeLabel: string;
  tpsLabel: string;
  tvqLabel: string;
  platformRetainedLabel: string;
  stationTransferredLabel: string;
  sectionAmounts: string;
  sectionParties: string;
  statusText: string;
  generatedOn: string;
}

type PdfAmountRow = { label: string; value: string; gold?: boolean; bold?: boolean; positive?: boolean };

const STATUS_RGB: Record<TxStatus, [number, number, number]> = {
  succeeded: [90, 138, 80],
  refunded: [29, 78, 216],
  failed: [190, 18, 60],
};

function fmt(n: number) {
  return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
}
function formatDT(d: string) {
  try {
    return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch asset: ${res.status}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateTransactionPdf(tx: TxRow, labels: PdfLabels): Promise<void> {
  const logoDataUrl = await fetchAsDataUrl('/logo/logo_2.png');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = 210;
  const mx = 18;
  const cw = W - mx * 2;
  const [sr, sg, sb] = STATUS_RGB[tx.status];

  // ─── White header with Hurryline logo ──────────────────────────────────
  // logo_2.png aspect ratio ≈ 3.04 : 1 (width : height)
  const logoW = 58;
  const logoH = 19;
  doc.addImage(logoDataUrl, 'PNG', mx, 7, logoW, logoH);

  // Document label (right side of header)
  doc.setTextColor(26, 26, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(labels.receiptLabel, W - mx, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 148, 136);
  doc.text(labels.pageTitle, W - mx, 20, { align: 'right' });

  // ─── Gold separator bar ───────────────────────────────────────────────
  doc.setFillColor(196, 154, 30);
  doc.rect(0, 31, W, 9, 'F');

  // ─── Status accent strip ──────────────────────────────────────────────
  doc.setFillColor(sr, sg, sb);
  doc.rect(0, 40, W, 4, 'F');

  let y = 54;

  // ─── Stripe reference block ───────────────────────────────────────────
  doc.setFillColor(249, 248, 245);
  doc.setDrawColor(232, 228, 220);
  doc.roundedRect(mx, y, cw, 21, 2, 2, 'FD');

  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(labels.stripeIdLabel.toUpperCase(), mx + 6, y + 8.5);

  doc.setTextColor(26, 26, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(tx.stripe_id, mx + 6, y + 16.5);

  y += 29;

  // ─── Status pill + date ───────────────────────────────────────────────
  doc.setFillColor(sr, sg, sb);
  doc.roundedRect(mx, y, 46, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(labels.statusText.toUpperCase(), mx + 23, y + 7, { align: 'center' });

  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(formatDT(tx.date), W - mx, y + 7, { align: 'right' });

  y += 20;

  // ─── Financial breakdown ──────────────────────────────────────────────
  /* Reservations expose the full tax/fee breakdown; tip and penalty rows carry
   * no snapshot, so they render a compact gross + net only. The last row is the
   * emphasized net figure (station transfer / payout). */
  const isReservation = tx.type === 'reservation' && tx.clientTotal != null;
  const rows: PdfAmountRow[] = isReservation
    ? [
        { label: labels.clientTotalLabel, value: fmt(tx.clientTotal ?? tx.gross), bold: true },
        ...(tx.platformServiceFee != null && tx.platformServiceFee > 0
          ? [{ label: labels.platformFeeLabel, value: fmt(tx.platformServiceFee) }]
          : []),
        ...(tx.tps != null && tx.tps > 0 ? [{ label: labels.tpsLabel, value: fmt(tx.tps) }] : []),
        ...(tx.tvq != null && tx.tvq > 0 ? [{ label: labels.tvqLabel, value: fmt(tx.tvq) }] : []),
        { label: labels.commissionLabel, value: fmt(tx.commission), gold: true },
        { label: labels.platformRetainedLabel, value: fmt(tx.platformRetained ?? tx.commission), gold: true },
        { label: labels.stationTransferredLabel, value: fmt(tx.stationTransferred ?? tx.payout), positive: true },
      ]
    : [
        { label: labels.grossLabel, value: fmt(tx.gross), bold: true },
        { label: labels.payoutLabel, value: fmt(tx.payout), positive: true },
      ];

  const rowGap = 11;
  const boxH = 20 + rows.length * rowGap;
  doc.setFillColor(249, 248, 245);
  doc.setDrawColor(232, 228, 220);
  doc.roundedRect(mx, y, cw, boxH, 2, 2, 'FD');

  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(labels.sectionAmounts.toUpperCase(), mx + 6, y + 9.5);

  // Gold left accent bar
  doc.setFillColor(196, 154, 30);
  doc.roundedRect(mx + 2.5, y + 5, 1.5, boxH - 10, 1, 1, 'F');

  let iy = y + 22;
  rows.forEach((row, idx) => {
    const isLast = idx === rows.length - 1;
    doc.setTextColor(26, 26, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isLast ? 12 : 10);
    doc.text(row.label, mx + 10, iy);
    if (row.positive) doc.setTextColor(90, 138, 80);
    else if (row.gold) doc.setTextColor(196, 154, 30);
    else doc.setTextColor(26, 26, 10);
    doc.setFont('helvetica', 'bold');
    doc.text(row.value, W - mx - 6, iy, { align: 'right' });
    iy += rowGap;
  });

  y += boxH + 8;

  // ─── Parties section ──────────────────────────────────────────────────
  doc.setFillColor(249, 248, 245);
  doc.setDrawColor(232, 228, 220);
  doc.roundedRect(mx, y, cw, 40, 2, 2, 'FD');

  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(labels.sectionParties.toUpperCase(), mx + 6, y + 9.5);

  // Status-colored left accent bar
  doc.setFillColor(sr, sg, sb);
  doc.roundedRect(mx + 2.5, y + 5, 1.5, 30, 1, 1, 'F');

  iy = y + 22;
  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(labels.typeLabel, mx + 10, iy);
  doc.setTextColor(26, 26, 10);
  doc.setFont('helvetica', 'bold');
  doc.text(tx.typeLabel.slice(0, 50), W - mx - 6, iy, { align: 'right' });

  iy += 12;
  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'normal');
  doc.text(labels.stationLabel, mx + 10, iy);
  doc.setTextColor(26, 26, 10);
  doc.setFont('helvetica', 'bold');
  doc.text(tx.station.slice(0, 50), W - mx - 6, iy, { align: 'right' });

  y += 48;

  // ─── Footer ───────────────────────────────────────────────────────────
  doc.setDrawColor(218, 214, 202);
  doc.setLineWidth(0.3);
  doc.line(mx, y, W - mx, y);

  y += 7;
  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Hurryline Inc. - Document confidentiel / Confidential document', mx, y);

  const today = new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`${labels.generatedOn} ${today}`, W - mx, y, { align: 'right' });

  doc.save(`Hurryline-tx-${tx.stripe_id.slice(-8).toLowerCase()}.pdf`);
}
