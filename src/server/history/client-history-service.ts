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
    total: string;
    commission: string | null;
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
  station: {
    name: string | null;
    address: string | null;
    city: string | null;
  };
  vehicle_format_label: string | null;
  amount_paid: string;
  commission_amount: string | null;
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
  const left = row.vehicle_format_label ?? 'Service';
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
      commission: row.commission_amount,
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
    station: {
      name: row.station_name,
      address: row.station_address,
      city: row.station_city,
    },
    vehicle_format_label: row.vehicle_format_label,
    amount_paid: row.amount_paid,
    commission_amount: row.commission_amount,
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

  return [
    `Slowtime - ${t['receipt_title'] ?? 'Receipt'}`,
    `${t['receipt_ref'] ?? 'Reference'}: ${receipt.reference}`,
    `${t['receipt_date'] ?? 'Date'}: ${receipt.date}`,
    `${t['receipt_status'] ?? 'Status'}: ${receipt.status}`,
    `${t['receipt_station'] ?? 'Station'}: ${receipt.station.name ?? '-'}`,
    `${t['receipt_address'] ?? 'Address'}: ${receipt.station.address ?? '-'} ${receipt.station.city ?? ''}`.trim(),
    `${t['receipt_service'] ?? 'Service'}: ${receipt.service.title ?? '-'}`,
    `${t['receipt_entry_type'] ?? 'Entry type'}: ${receipt.service.entry_type}`,
    `${t['receipt_total'] ?? 'Total'}: ${receipt.amount.total} ${receipt.amount.currency}`,
    `${t['receipt_commission'] ?? 'Commission'}: ${receipt.amount.commission ?? '-'}`,
    `${t['receipt_tip'] ?? 'Tip'}: ${receipt.amount.tip ?? '-'}`,
  ];
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

