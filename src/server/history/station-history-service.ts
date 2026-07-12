/**
 * Business logic for station activity history.
 */
import { listStationHistory } from './station-history-repository';
import type { StationHistoryQuery } from '@/validators/history';

export type StationHistoryParams = StationHistoryQuery & { stationId: string };

export type StationHistoryEntry = {
  id: string;
  date: Date;
  entry_type: 'reservation' | 'queue';
  status: string;
  client: { first_name: string; last_name: string } | null;
  vehicle_format_label: string | null;
  service_name: string | null;
  service_category: string | null;
  amount_paid: string;
  station_payout: string | null;
  commission_rate: string;
  commission_amount: string | null;
  station_service_total: string | null;
  platform_service_fee: string | null;
  taxable_subtotal: string | null;
  tps_amount: string | null;
  tvq_amount: string | null;
  client_total: string | null;
  platform_subtotal: string | null;
  platform_tax_amount: string | null;
  platform_total_retained: string | null;
  station_subtotal: string | null;
  station_tax_amount: string | null;
  station_total_transferred: string | null;
  tip_amount: string | null;
  penalty_amount: string | null;
  reservation_ref: string | null;
};

export type StationHistoryMeta = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

/**
 * Retrieves paginated station history combining reservation and financial data.
 * Each item represents one reservation enriched with its financial transaction details.
 */
export async function getStationHistory(
  params: StationHistoryParams
): Promise<{ items: StationHistoryEntry[]; meta: StationHistoryMeta }> {
  const {
    stationId,
    page = 1,
    limit = 20,
    from,
    to,
    status,
    amount_min,
    amount_max,
  } = params;

  const result = await listStationHistory({
    stationId,
    page,
    limit,
    from,
    to,
    status,
    amount_min,
    amount_max,
  });

  const total_pages = result.total > 0 ? Math.ceil(result.total / limit) : 0;

  const items: StationHistoryEntry[] = result.items.map((item) => ({
    id: item.id,
    date: item.date,
    entry_type: item.entry_type,
    status: item.status,
    client:
      item.client_first_name && item.client_last_name
        ? { first_name: item.client_first_name, last_name: item.client_last_name }
        : null,
    vehicle_format_label: item.vehicle_format_label,
    service_name: item.service_name,
    service_category: item.service_category,
    amount_paid: item.amount_paid,
    station_payout: item.station_payout,
    commission_rate: item.commission_rate,
    commission_amount: item.commission_amount,
    station_service_total: item.station_service_total,
    platform_service_fee: item.platform_service_fee,
    taxable_subtotal: item.taxable_subtotal,
    tps_amount: item.tps_amount,
    tvq_amount: item.tvq_amount,
    client_total: item.client_total,
    platform_subtotal: item.platform_subtotal,
    platform_tax_amount: item.platform_tax_amount,
    platform_total_retained: item.platform_total_retained,
    station_subtotal: item.station_subtotal,
    station_tax_amount: item.station_tax_amount,
    station_total_transferred: item.station_total_transferred,
    tip_amount: item.tip_amount,
    penalty_amount: item.penalty_amount,
    reservation_ref: item.id,
  }));

  return {
    items,
    meta: { total: result.total, page, limit, total_pages },
  };
}
