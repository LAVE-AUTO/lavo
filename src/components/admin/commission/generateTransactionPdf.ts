import { jsPDF } from 'jspdf';
import type { TxRow, TxStatus } from './AdminTransactionDrawer';

export interface PdfLabels {
  pageTitle: string;
  stripeIdLabel: string;
  grossLabel: string;
  commissionLabel: string;
  payoutLabel: string;
  stationLabel: string;
  clientLabel: string;
  sectionAmounts: string;
  sectionParties: string;
  statusText: string;
  generatedOn: string;
}

const STATUS_RGB: Record<TxStatus, [number, number, number]> = {
  succeeded: [90, 138, 80],
  refunded:  [29, 78, 216],
  failed:    [190, 18, 60],
};

function fmt(n: number) {
  return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
}
function formatDT(d: string) {
  try {
    return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

export function generateTransactionPdf(tx: TxRow, labels: PdfLabels): void {
  const doc  = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W    = 210;
  const mx   = 18;
  const cw   = W - mx * 2;
  const [sr, sg, sb] = STATUS_RGB[tx.status];

  // ─── Gold header ──────────────────────────────────────────────────────
  doc.setFillColor(196, 154, 30);
  doc.rect(0, 0, W, 40, 'F');

  // Brand name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text('LAVO', mx, 26);

  // Subtitle (right-aligned)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(labels.pageTitle, W - mx, 19, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setTextColor(255, 230, 160);
  doc.text('Slowtime Inc.', W - mx, 27, { align: 'right' });

  // ─── Status accent strip ──────────────────────────────────────────────
  doc.setFillColor(sr, sg, sb);
  doc.rect(0, 40, W, 4.5, 'F');

  let y = 55;

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
  doc.setFillColor(249, 248, 245);
  doc.setDrawColor(232, 228, 220);
  doc.roundedRect(mx, y, cw, 57, 2, 2, 'FD');

  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(labels.sectionAmounts.toUpperCase(), mx + 6, y + 9.5);

  // Left accent bar (gold)
  doc.setFillColor(196, 154, 30);
  doc.roundedRect(mx + 2.5, y + 5, 1.5, 47, 1, 1, 'F');

  let iy = y + 22;

  // Gross row
  doc.setTextColor(26, 26, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(labels.grossLabel, mx + 10, iy);
  doc.setFont('helvetica', 'bold');
  doc.text(fmt(tx.gross), W - mx - 6, iy, { align: 'right' });

  // Commission row
  iy += 13;
  doc.setTextColor(26, 26, 10);
  doc.setFont('helvetica', 'normal');
  doc.text(labels.commissionLabel, mx + 10, iy);
  doc.setTextColor(196, 154, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(`- ${fmt(tx.commission)}`, W - mx - 6, iy, { align: 'right' });

  // Separator
  iy += 8;
  doc.setDrawColor(218, 214, 202);
  doc.setLineWidth(0.4);
  doc.line(mx + 10, iy, W - mx - 6, iy);

  // Payout row
  iy += 10;
  doc.setTextColor(26, 26, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(labels.payoutLabel, mx + 10, iy);
  doc.setTextColor(90, 138, 80);
  doc.text(fmt(tx.payout), W - mx - 6, iy, { align: 'right' });

  y += 65;

  // ─── Parties section ──────────────────────────────────────────────────
  doc.setFillColor(249, 248, 245);
  doc.setDrawColor(232, 228, 220);
  doc.roundedRect(mx, y, cw, 40, 2, 2, 'FD');

  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(labels.sectionParties.toUpperCase(), mx + 6, y + 9.5);

  // Left accent bar (status color)
  doc.setFillColor(sr, sg, sb);
  doc.roundedRect(mx + 2.5, y + 5, 1.5, 30, 1, 1, 'F');

  iy = y + 22;

  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(labels.stationLabel, mx + 10, iy);
  doc.setTextColor(26, 26, 10);
  doc.setFont('helvetica', 'bold');
  doc.text(tx.station, W - mx - 6, iy, { align: 'right' });

  iy += 12;
  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'normal');
  doc.text(labels.clientLabel, mx + 10, iy);
  doc.setTextColor(26, 26, 10);
  doc.setFont('helvetica', 'bold');
  doc.text(tx.client, W - mx - 6, iy, { align: 'right' });

  y += 48;

  // ─── Footer ───────────────────────────────────────────────────────────
  doc.setDrawColor(218, 214, 202);
  doc.setLineWidth(0.3);
  doc.line(mx, y, W - mx, y);

  y += 7;
  doc.setTextColor(150, 148, 136);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('LAVO · Slowtime Inc.', mx, y);

  const today = new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`${labels.generatedOn} ${today}`, W - mx, y, { align: 'right' });

  doc.save(`lavo-tx-${tx.stripe_id.slice(-8).toLowerCase()}.pdf`);
}
