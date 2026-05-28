/**
 * Business logic for client history and receipt endpoints.
 */
import {
  findClientHistoryReceiptByEntryId,
  listClientHistory,
  type ClientHistoryRepositoryItem,
} from './client-history-repository';
import type { ClientHistoryAllowedStatus, ClientHistoryQuery } from '@/validators/history';
import { getStripeReceiptUrl } from '@/server/payments/payment-service';
import { NotFoundError } from '@/lib/errors';
import { isTrustedStripeReceiptUrl } from '@/lib/stripe-utils';

const DEFAULT_CLIENT_HISTORY_STATUSES: ClientHistoryAllowedStatus[] = [
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
];

type ClientHistoryAppReceipt = {
  entry_id: string;
  reference: string;
  date: string;
  status: string;
  station: {
    name: string | null;
    address: string | null;
    city: string | null;
  };
  service: {
    entry_type: 'reservation' | 'queue';
    title: string | null;
    slot_start_time: string | null;
  };
  amount: {
    /** Total paid by the client (service + tip when applicable). */
    total: string;
    /** Tip recorded for this entry, if any. Used on the receipt as a separate line. */
    tip: string | null;
    currency: 'EUR';
  };
};

export type ClientHistoryItem = {
  id: string;
  title: string;
  status: string;
  entry_type: 'reservation' | 'queue';
  created_at: string;
  slot_start_time: string | null;
  station: {
    name: string | null;
    address: string | null;
    city: string | null;
    image_url: string | null;
  };
  vehicle_format_label: string | null;
  service_name: string | null;
  service_category: string | null;
  amount_paid: string;
  tip_amount: string | null;
  receipt_available: boolean;
  receipt_type: 'stripe_link' | 'app_payload' | 'none';
};

export type ClientHistoryMeta = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
};

export type ClientHistoryResult = {
  items: ClientHistoryItem[];
  meta: ClientHistoryMeta;
};

export type ClientHistoryReceiptDetail = {
  entry_id: string;
  stripe_receipt_url: string | null;
  app_receipt: ClientHistoryAppReceipt | null;
};

export type ClientHistoryPdfReceipt = {
  filename: string;
  stripe_receipt_url: string | null;
  app_receipt: ClientHistoryAppReceipt | null;
  text_lines: string[];
};

function toIsoDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function hasAppReceipt(row: ClientHistoryRepositoryItem): boolean {
  const amount = Number.parseFloat(row.amount_paid);
  return !Number.isNaN(amount) && amount > 0;
}

function buildTitle(row: ClientHistoryRepositoryItem): string {
  const left = row.service_name ?? row.vehicle_format_label ?? 'Service';
  const right = row.station_name ?? 'Station';
  return `${left} - ${right}`;
}

function buildAppReceipt(row: ClientHistoryRepositoryItem): ClientHistoryAppReceipt | null {
  if (!hasAppReceipt(row)) return null;

  return {
    entry_id: row.id,
    // Do not expose raw Stripe PaymentIntent identifiers to clients.
    reference: row.id,
    date: row.created_at.toISOString(),
    status: row.status,
    station: {
      name: row.station_name,
      address: row.station_address,
      city: row.station_city,
    },
    service: {
      entry_type: row.entry_type,
      title: buildTitle(row),
      slot_start_time: toIsoDate(row.slot_start_time),
    },
    amount: {
      total: row.amount_paid,
      tip: row.tip_amount,
      currency: 'EUR',
    },
  };
}

function mapHistoryItem(row: ClientHistoryRepositoryItem): ClientHistoryItem {
  const appReceiptAvailable = hasAppReceipt(row);
  const hasStripeReceiptReference = Boolean(row.stripe_payment_id);
  const receiptAvailable = appReceiptAvailable || hasStripeReceiptReference;
  const receiptType = hasStripeReceiptReference
    ? 'stripe_link'
    : appReceiptAvailable
      ? 'app_payload'
      : 'none';
  return {
    id: row.id,
    title: buildTitle(row),
    status: row.status,
    entry_type: row.entry_type,
    created_at: row.created_at.toISOString(),
    slot_start_time: toIsoDate(row.slot_start_time),
    station: {
      name: row.station_name,
      address: row.station_address,
      city: row.station_city,
      image_url: row.station_image_url,
    },
    vehicle_format_label: row.vehicle_format_label,
    service_name: row.service_name,
    service_category: row.service_category,
    amount_paid: row.amount_paid,
    tip_amount: row.tip_amount,
    receipt_available: receiptAvailable,
    receipt_type: receiptType,
  };
}

async function toPdfTextLines(receipt: ClientHistoryAppReceipt, locale: string): Promise<string[]> {
  const normalizedLocale = locale.startsWith('en') ? 'en' : 'fr';
  // Load labels from the official translation files so FR and EN are consistent.
  const messages = (await import(`../../../messages/${normalizedLocale}.json`)).default as {
    history: Record<string, string>;
  };
  const t = messages.history;

  /* Items breakdown: service line first, optional tip line, then total.
   * Commission is internal accounting and never surfaced to the client. */
  const tip = receipt.amount.tip ? Number.parseFloat(receipt.amount.tip) : 0;
  const total = Number.parseFloat(receipt.amount.total);
  const subtotal = Math.max(0, total - tip);

  const lines: string[] = [
    `Hurryline - ${t['receipt_title'] ?? 'Receipt'}`,
    `${t['receipt_ref'] ?? 'Reference'}: ${receipt.reference}`,
    `${t['receipt_date'] ?? 'Date'}: ${receipt.date}`,
    `${t['receipt_status'] ?? 'Status'}: ${receipt.status}`,
    `${t['receipt_station'] ?? 'Station'}: ${receipt.station.name ?? '-'}`,
    `${t['receipt_address'] ?? 'Address'}: ${receipt.station.address ?? '-'} ${receipt.station.city ?? ''}`.trim(),
    '',
    `${t['receipt_items'] ?? 'Items'}:`,
    `- ${receipt.service.title ?? '-'} (${receipt.service.entry_type}): ${subtotal.toFixed(2)} ${receipt.amount.currency}`,
  ];
  if (tip > 0) {
    lines.push(`- ${t['receipt_tip'] ?? 'Tip'}: ${tip.toFixed(2)} ${receipt.amount.currency}`);
  }
  lines.push('');
  lines.push(`${t['receipt_total'] ?? 'Total'}: ${total.toFixed(2)} ${receipt.amount.currency}`);

  return lines;
}

/**
 * Returns paginated and filtered history entries for one client.
 */
export async function getClientHistory(
  userId: string,
  query: ClientHistoryQuery
): Promise<ClientHistoryResult> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const statuses = (query.status as ClientHistoryAllowedStatus[] | undefined) ?? DEFAULT_CLIENT_HISTORY_STATUSES;
  const sortBy = query.sort_by ?? 'created_at';
  const sortOrder = query.sort_order ?? 'desc';

  const result = await listClientHistory({
    userId,
    statuses,
    page,
    limit,
    entry_type: query.entry_type,
    from: query.from,
    to: query.to,
    amount_min: query.amount_min,
    amount_max: query.amount_max,
    q: query.q,
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  const total_pages = result.total > 0 ? Math.ceil(result.total / limit) : 0;
  const items = result.items.map(mapHistoryItem);

  return {
    items,
    meta: {
      total: result.total,
      page,
      limit,
      total_pages,
      has_next_page: page < total_pages,
      has_prev_page: page > 1,
    },
  };
}

/**
 * Returns receipt detail for one history entry owned by the client.
 */
export async function getClientHistoryReceiptDetail(
  userId: string,
  entryId: string
): Promise<ClientHistoryReceiptDetail> {
  const row = await findClientHistoryReceiptByEntryId(userId, entryId);
  if (!row) {
    throw new NotFoundError('History entry not found');
  }

  const appReceipt = buildAppReceipt(row);
  let stripeReceiptUrl: string | null = null;
  if (row.stripe_payment_id) {
    try {
      const candidateUrl = await getStripeReceiptUrl(row.stripe_payment_id);
      if (candidateUrl && isTrustedStripeReceiptUrl(candidateUrl)) {
        stripeReceiptUrl = candidateUrl;
      }
    } catch (error) {
      console.error('[client-history] Failed to fetch Stripe receipt URL', {
        entryId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    entry_id: row.id,
    stripe_receipt_url: stripeReceiptUrl,
    app_receipt: appReceipt,
  };
}

/**
 * Returns data needed by the receipt.pdf endpoint.
 *
 * @param userId - Authenticated client user ID.
 * @param entryId - History entry UUID.
 * @param locale  - BCP 47 locale string (e.g. "fr", "en-US"). Defaults to "fr".
 */
export async function getClientHistoryReceiptPdf(
  userId: string,
  entryId: string,
  locale: string = 'fr'
): Promise<ClientHistoryPdfReceipt> {
  const detail = await getClientHistoryReceiptDetail(userId, entryId);
  const filename = `receipt-${entryId}.pdf`;
  const text_lines = detail.app_receipt
    ? await toPdfTextLines(detail.app_receipt, locale)
    : ['Receipt unavailable'];

  return {
    filename,
    stripe_receipt_url: detail.stripe_receipt_url,
    app_receipt: detail.app_receipt,
    text_lines,
  };
}

