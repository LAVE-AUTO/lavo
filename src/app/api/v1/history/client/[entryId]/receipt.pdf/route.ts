/**
 * GET /api/v1/history/client/:entryId/receipt.pdf
 * Returns receipt PDF for one client entry (Stripe link prioritized when available).
 */
import { requireRole } from '@/lib/require-role';
import { error400, error404, error429, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { clientHistoryReceiptParamSchema, mapZodErrors } from '@/validators/history';
import { getClientHistoryReceiptPdf } from '@/server/history/client-history-service';
import { extractLocale } from '@/lib/email';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import { NextResponse } from 'next/server';

/** 20 requests per minute per user. */
const pdfLimiter = createEndpointRateLimiter({ maxRequests: 20, windowMs: 60_000 });

type Params = { params: Promise<{ entryId: string }> };

function escapePdfText(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function generateSimplePdfFromLines(lines: string[]): Uint8Array {
  const safeLines = lines.map((line) => escapePdfText(line));
  const content = ['BT', '/F1 12 Tf', '50 780 Td'];
  for (let index = 0; index < safeLines.length; index += 1) {
    const line = safeLines[index] ?? '';
    if (index > 0) {
      content.push('0 -18 Td');
    }
    content.push(`(${line}) Tj`);
  }
  content.push('ET');

  const streamContent = content.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(streamContent, 'utf8')} >> stream\n${streamContent}\nendstream endobj`,
  ];

  const chunks = ['%PDF-1.4\n'];
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(chunks.join(''), 'utf8'));
    chunks.push(`${obj}\n`);
  }

  const xrefStart = Buffer.byteLength(chunks.join(''), 'utf8');
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i += 1) {
    chunks.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  chunks.push(`trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Uint8Array(Buffer.from(chunks.join(''), 'utf8'));
}

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  if (pdfLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

  const { entryId } = await params;
  const parsed = clientHistoryReceiptParamSchema.safeParse({ entryId });
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const locale = extractLocale(request.headers.get('accept-language'));
    const result = await getClientHistoryReceiptPdf(auth.sub, parsed.data.entryId, locale);

    if (result.stripe_receipt_url) {
      return applyNoStoreHeaders(NextResponse.redirect(result.stripe_receipt_url, 302));
    }

    const pdfBytes = generateSimplePdfFromLines(result.text_lines);
    const pdfResponse = new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${result.filename}"`,
      },
    });
    return applyNoStoreHeaders(pdfResponse);
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
