/**
 * GET /api/v1/history/client/:entryId/receipt.pdf
 * Returns receipt PDF for one client entry (Stripe link prioritized when available).
 */
import { requireRole } from '@/lib/require-role';
import { error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { clientHistoryReceiptParamSchema, mapZodErrors } from '@/validators/history';
import { getClientHistoryReceiptPdf } from '@/server/history/client-history-service';
import { AppError, NotFoundError } from '@/lib/errors';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ entryId: string }> };

function applyNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Vary', 'Authorization, Cookie');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

function escapePdfText(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function isTrustedStripeReceiptUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== '443') return false;
    const host = parsed.hostname.toLowerCase();
    if (!(host === 'stripe.com' || host.endsWith('.stripe.com'))) return false;

    // Only allow Stripe receipt pages to avoid unrelated external redirects.
    return /^\/receipts(\/|$)/.test(parsed.pathname);
  } catch {
    return false;
  }
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

  const { entryId } = await params;
  const parsed = clientHistoryReceiptParamSchema.safeParse({ entryId });
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const result = await getClientHistoryReceiptPdf(auth.sub, parsed.data.entryId);

    if (result.stripe_receipt_url && isTrustedStripeReceiptUrl(result.stripe_receipt_url)) {
      const redirectResponse = NextResponse.redirect(result.stripe_receipt_url, 302);
      applyNoStoreHeaders(redirectResponse);
      redirectResponse.headers.set('Referrer-Policy', 'no-referrer');
      redirectResponse.headers.set('X-Content-Type-Options', 'nosniff');
      redirectResponse.headers.set('X-Frame-Options', 'DENY');
      return redirectResponse;
    }

    const pdfBytes = generateSimplePdfFromLines(result.text_lines);
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${result.filename}"`,
        'Cache-Control': 'private, no-store',
        Pragma: 'no-cache',
        Vary: 'Authorization, Cookie',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
