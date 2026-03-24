'use client';

// TODO: disputes data — connect to API once GET /admin/disputes endpoint is available

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getFromApi } from '@/services/axios-service';

interface Station {
  id: string;
  name: string;
  created_at: string;
}

// Mock disputes — replace once GET /admin/disputes is implemented
const MOCK_DISPUTES = [
  { id: 'd-1', client: 'Marc Dupont',    amount: '25 $',  date: '2026-03-22T10:00:00Z' },
  { id: 'd-2', client: 'Sophie Laurent', amount: '40 $',  date: '2026-03-21T14:30:00Z' },
  { id: 'd-3', client: 'Jean Tremblay',  amount: '15 $',  date: '2026-03-20T09:15:00Z' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function AlertPanel({
  title,
  count,
  color,
  children,
  actionLabel,
  actionHref,
  mockBadge,
}: {
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
  actionLabel: string;
  actionHref: string;
  mockBadge?: string;
}) {
  return (
    <div className="flex-1 overflow-hidden rounded-xl border border-[#DDD9CC] bg-[#F0EDE0] dark:border-[#1A2A14] dark:bg-[#1E2A1A]">
      {/* Top accent */}
      <div className="h-[3px] w-full" style={{ background: color }} />

      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{title}</span>
            {count > 0 && (
              <span
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black text-white"
                style={{ background: color }}
              >
                {count}
              </span>
            )}
            {mockBadge && (
              <span className="rounded-full bg-[#F5E6BB] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8A6A00] dark:bg-[#2A2210] dark:text-[#C49A1E]">
                {mockBadge}
              </span>
            )}
          </div>
          <Link
            href={actionHref as Parameters<typeof Link>[0]['href']}
            className="text-[10px] font-bold text-[#C49A1E] hover:underline"
          >
            {actionLabel} →
          </Link>
        </div>

        {/* List */}
        <div className="flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

export function AdminAlertsSection() {
  const t = useTranslations('admin_dashboard');
  const [stations, setStations]     = useState<Station[]>([]);
  const [kycLoading, setKycLoading] = useState(true);
  const [kycError, setKycError]     = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [ok, data] = await getFromApi<{ data: Station[] }>('/admin/stations');
      if (!mounted) return;
      if (ok) setStations((data as { data: Station[] }).data ?? []);
      else setKycError(true);
      setKycLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex gap-4 px-5 py-4">
      {/* KYC panel — real data */}
      <AlertPanel
        title={t('alert_kyc_title')}
        count={stations.length}
        color="#C49A1E"
        actionLabel={t('alert_kyc_action')}
        actionHref="/admin/stations"
      >
        {kycLoading && (
          <p className="text-[11px] text-[#888] dark:text-[#6A6A5A]">{t('alert_kyc_loading')}</p>
        )}
        {!kycLoading && kycError && (
          <p className="text-[11px] text-[#E8472A]">{t('alert_kyc_error')}</p>
        )}
        {!kycLoading && !kycError && stations.length === 0 && (
          <p className="text-[11px] text-[#888] dark:text-[#6A6A5A]">{t('alert_kyc_empty')}</p>
        )}
        {!kycLoading && stations.map((s) => (
          <Link
            key={s.id}
            href={`/admin/stations/${s.id}` as Parameters<typeof Link>[0]['href']}
            className="flex items-center justify-between rounded-[8px] bg-white px-3 py-2 text-[11px] transition-colors hover:bg-[#F5F4EE] dark:bg-[#182214] dark:hover:bg-[#1E2A1A]"
          >
            <span className="font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{s.name}</span>
            <span className="text-[10px] text-[#888] dark:text-[#6A6A5A]">{formatDate(s.created_at)}</span>
          </Link>
        ))}
      </AlertPanel>

      {/* Disputes panel — mock data */}
      <AlertPanel
        title={t('alert_disputes_title')}
        count={MOCK_DISPUTES.length}
        color="#E8472A"
        actionLabel={t('alert_disputes_action')}
        actionHref="/admin/disputes"
        mockBadge={t('kpi_mock_note')}
      >
        {MOCK_DISPUTES.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-[8px] bg-white px-3 py-2 dark:bg-[#182214]"
          >
            <div>
              <span className="block text-[11px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{d.client}</span>
              <span className="text-[10px] text-[#888] dark:text-[#6A6A5A]">{formatDate(d.date)}</span>
            </div>
            <span className="text-[11px] font-bold text-[#E8472A]">{d.amount}</span>
          </div>
        ))}
      </AlertPanel>
    </div>
  );
}
