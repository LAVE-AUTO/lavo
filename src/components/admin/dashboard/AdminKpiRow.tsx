'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services/axios-service';

interface KpiCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  trendValue: string;
  trendLabel: string;
  trendUp: boolean;
  sparkline: number[];
  accentColor: string;
  animationDelay?: string;
}

function Sparkline({ bars, color }: { bars: number[]; color: string }) {
  if (bars.length === 0) return null;
  const max = Math.max(...bars, 1);
  return (
    <div className="flex items-end gap-[3px] h-7" aria-hidden="true">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all duration-300"
          style={{
            height: `${(h / max) * 100}%`,
            background: i === bars.length - 1 ? color : `${color}40`,
          }}
        />
      ))}
    </div>
  );
}

function KpiCard({ icon, value, label, trendValue, trendLabel, trendUp, sparkline, accentColor, animationDelay }: KpiCardProps) {
  return (
    <div
      data-testid="kpi-card"
      className="animate-fade-in-up relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-[#1A2416] dark:ring-white/[0.06]"
      style={{ animationDelay }}
    >
      {/* Top row: icon + trend badge */}
      <div className="mb-4 flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${accentColor}18` }}
        >
          {icon}
        </div>
        <span
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black"
          style={{
            background: trendUp ? '#00C85118' : '#EF444418',
            color: trendUp ? '#00A041' : '#EF4444',
          }}
        >
          {trendUp ? '▲' : '▼'} {trendValue}
        </span>
      </div>

      {/* Value */}
      <div className="mb-0.5 text-[28px] font-black leading-none tracking-tight text-[#0F1A0C] dark:text-[#F0EDD4]">
        {value}
      </div>
      <div className="mb-4 text-[11px] font-medium text-[#888] dark:text-[#6A6A5A]">
        {label}
        <span className="ml-1.5 text-[#AAA] dark:text-[#4A4A3A]">— {trendLabel}</span>
      </div>

      {/* Sparkline */}
      <Sparkline bars={sparkline} color={accentColor} />
    </div>
  );
}

const GOLD = '#C49A1E';

const TransactionsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const CommissionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const MerchantsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
const ClientsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

interface DashboardResponse {
  data: {
    totals: { active_stations: number; total_clients: number; pending_kyc: number; open_support_tickets: number };
    metrics: { total_transactions: number; total_revenue: string; total_commissions: string };
  };
}

function fmtCurrency(v: string | number) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '0 $';
  return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function AdminKpiRow() {
  const t = useTranslations('admin_dashboard');
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardResponse['data'] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ok, res] = await getFromApi('/admin/dashboard');
        if (!mountedRef.current) return;
        if (ok) setData((res as DashboardResponse).data);
      } catch {
        // keep null
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
      </div>
    );
  }

  const totals = data?.totals;
  const metrics = data?.metrics;

  const cards: KpiCardProps[] = [
    { icon: <TransactionsIcon />, value: fmtCurrency(metrics?.total_revenue ?? '0'), label: t('kpi_transactions'), trendValue: String(metrics?.total_transactions ?? 0), trendUp: true, trendLabel: t('kpi_trend_vs_yesterday'), sparkline: [], accentColor: GOLD, animationDelay: '0ms' },
    { icon: <CommissionIcon />,   value: fmtCurrency(metrics?.total_commissions ?? '0'), label: t('kpi_commissions'), trendValue: '-', trendUp: true, trendLabel: t('kpi_trend_vs_yesterday'), sparkline: [], accentColor: GOLD, animationDelay: '60ms' },
    { icon: <MerchantsIcon />,    value: String(totals?.active_stations ?? 0), label: t('kpi_merchants'), trendValue: `${totals?.pending_kyc ?? 0} KYC`, trendUp: (totals?.pending_kyc ?? 0) > 0, trendLabel: t('kpi_vs_last_month'), sparkline: [], accentColor: '#3B82F6', animationDelay: '120ms' },
    { icon: <ClientsIcon />,      value: String(totals?.total_clients ?? 0), label: t('kpi_clients'), trendValue: '-', trendUp: true, trendLabel: t('kpi_vs_last_month'), sparkline: [], accentColor: '#10B981', animationDelay: '180ms' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <KpiCard key={i} {...card} />
      ))}
    </div>
  );
}
