'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getFromApi } from '@/services/axios-service';

interface Station {
  id: string;
  name: string;
  created_at: string;
}

interface ApiDispute {
  id: string;
  client_id: string;
  status: string;
  requested_amount: string | null;
  created_at: string;
  station: { id: string; name: string; city: string } | null;
}

interface DisputeAlert {
  id: string;
  label: string;
  amount: string;
  date: string;
  urgent: boolean;
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CA', { day: '2-digit', month: '2-digit' });
}

function SectionPanel({
  icon, title, count, color, actionLabel, actionHref, mockBadge, children, empty, emptyLabel,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
  actionLabel: string;
  actionHref: string;
  mockBadge?: string;
  children: React.ReactNode;
  empty: boolean;
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[#001A05] dark:ring-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${color}18` }}>
            {icon}
          </div>
          <span className="text-[13px] font-black text-[#001201] dark:text-[#FFF9EC]">{title}</span>
          {count > 0 && (
            <span
              className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-black text-white"
              style={{ background: color }}
            >
              {count}
            </span>
          )}
          {mockBadge && (
            <span className="rounded-full bg-[#F5E6BB] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8A6A00] dark:bg-[#2A2210] dark:text-[#DDAF3B]">
              {mockBadge}
            </span>
          )}
        </div>
        <Link
          href={actionHref as Parameters<typeof Link>[0]['href']}
          className="rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-[#F0EDE0] dark:hover:bg-[#182214]"
          style={{ color }}
        >
          Voir tout →
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-[#F0EDE0] dark:bg-[#001A05]" />

      {/* Content */}
      <div className="flex flex-col gap-0 overflow-y-auto">
        {empty ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2 text-[28px] opacity-20" aria-hidden="true">✓</div>
            <p className="text-[13px] font-medium text-[#AAA] dark:text-[#B0BFB1]">{emptyLabel}</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

const KycIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const DisputeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#391C01" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export function AdminAlertsSection() {
  const t = useTranslations('admin_dashboard');
  const [stations, setStations]     = useState<Station[]>([]);
  const [kycLoading, setKycLoading] = useState(true);
  const [kycError, setKycError]     = useState(false);
  const [disputes, setDisputes]         = useState<DisputeAlert[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [okKyc, dataKyc] = await getFromApi('/admin/stations');
        if (!mounted) return;
        if (okKyc) setStations((dataKyc as { data: { stations: Station[] } }).data?.stations ?? []);
        else setKycError(true);
      } catch {
        if (mounted) setKycError(true);
      } finally {
        if (mounted) setKycLoading(false);
      }

      try {
        const [okD, dataD] = await getFromApi('/admin/disputes');
        if (!mounted) return;
        if (okD) {
          const items = (dataD as { data: { items: ApiDispute[] } }).data?.items ?? [];
          const openDisputes = items
            .filter((d) => d.status === 'open')
            .slice(0, 5)
            .map((d): DisputeAlert => ({
              id: d.id,
              label: d.station?.name ?? t('alert_disputes_unknown_station'),
              amount: d.requested_amount ? `${parseFloat(d.requested_amount).toFixed(0)} $` : '-',
              date: d.created_at,
              urgent: Date.now() - new Date(d.created_at).getTime() > 3 * 24 * 60 * 60 * 1000,
            }));
          setDisputes(openDisputes);
        }
      } catch {
        // keep empty
      } finally {
        if (mounted) setDisputesLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex gap-5">
      {/* KYC panel */}
      <SectionPanel
        icon={<KycIcon />}
        title={t('alert_kyc_title')}
        count={stations.length}
        color="#DDAF3B"
        actionLabel={t('alert_kyc_action')}
        actionHref="/admin/stations"
        empty={!kycLoading && !kycError && stations.length === 0}
        emptyLabel={t('alert_kyc_empty')}
      >
        {kycLoading && (
          <div className="px-5 py-4 text-[12px] text-[#AAA] dark:text-[#B0BFB1]">{t('alert_kyc_loading')}</div>
        )}
        {!kycLoading && kycError && (
          <div className="px-5 py-4 text-[12px] text-[#391C01]">{t('alert_kyc_error')}</div>
        )}
        {!kycLoading && stations.map((s, i) => (
          <Link
            key={s.id}
            href={`/admin/stations/${s.id}` as Parameters<typeof Link>[0]['href']}
            className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#F8F6EE] dark:hover:bg-[#182214]${i > 0 ? ' border-t border-[#F0EDE0] dark:border-[#001A05]' : ''}`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DDAF3B]/10 text-[12px] font-black text-[#DDAF3B]">
              {initials(s.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{s.name}</div>
              <div className="text-[11px] text-[#AAA] dark:text-[#B0BFB1]">{formatDate(s.created_at)}</div>
            </div>
            <span className="shrink-0 rounded-full bg-[#DDAF3B]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#DDAF3B]">
              KYC
            </span>
          </Link>
        ))}
      </SectionPanel>

      {/* Disputes panel */}
      <SectionPanel
        icon={<DisputeIcon />}
        title={t('alert_disputes_title')}
        count={disputes.length}
        color="#391C01"
        actionLabel={t('alert_disputes_action')}
        actionHref="/admin/disputes"
        empty={!disputesLoading && disputes.length === 0}
        emptyLabel={t('alert_disputes_empty')}
      >
        {disputesLoading && (
          <div className="px-5 py-4 text-[12px] text-[#AAA] dark:text-[#B0BFB1]">{t('alert_disputes_loading')}</div>
        )}
        {!disputesLoading && disputes.map((d, i) => (
          <Link
            key={d.id}
            href={`/admin/disputes/${d.id}` as Parameters<typeof Link>[0]['href']}
            className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#F8F6EE] dark:hover:bg-[#182214]${i > 0 ? ' border-t border-[#F0EDE0] dark:border-[#001A05]' : ''}`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#391C01]/10 text-[12px] font-black text-[#391C01]">
              {initials(d.label)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{d.label}</div>
              <div className="text-[11px] text-[#AAA] dark:text-[#B0BFB1]">{formatDate(d.date)}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[13px] font-black text-[#391C01]">{d.amount}</span>
              {d.urgent && (
                <span className="rounded-full bg-[#FEF2F2] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#391C01] dark:bg-[#2A0A0A]">
                  Urgent
                </span>
              )}
            </div>
          </Link>
        ))}
      </SectionPanel>
    </div>
  );
}
