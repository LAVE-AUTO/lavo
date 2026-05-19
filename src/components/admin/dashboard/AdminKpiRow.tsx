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
  masked?: boolean;
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

function KpiCard({ icon, value, label, trendValue, trendLabel, trendUp, sparkline, accentColor, animationDelay, masked }: KpiCardProps) {
  return (
    <div
      data-testid="kpi-card"
      className="animate-fade-in-up group relative isolate overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,247,239,0.92)_100%)] p-5 shadow-[0_18px_45px_rgba(15,26,12,0.08)] ring-1 ring-black/[0.04] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,26,12,0.12)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(20,28,16,0.96)_0%,rgba(14,20,10,0.92)_100%)] dark:ring-white/[0.06]"
      style={{ animationDelay }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: accentColor }}
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl opacity-20 transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)` }}
      />

      <div className="relative mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/70 shadow-[0_8px_18px_rgba(15,26,12,0.08)] ring-1 ring-black/[0.04] dark:border-white/10 dark:ring-white/[0.05]"
            style={{ background: `${accentColor}16` }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-bold uppercase tracking-[0.22em] text-[#8A8A7C] dark:text-[#A0A090]">
              {label}
            </div>
            <div className="mt-2 text-[clamp(1.9rem,3vw,2.6rem)] font-black leading-none tracking-tight text-[#0F1A0C] dark:text-[#F0EDD4]">
              {masked ? '••••' : value}
            </div>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] shadow-sm"
          style={{
            background: trendUp ? '#00C85114' : '#EF444414',
            borderColor: trendUp ? '#00C85120' : '#EF444420',
            color: trendUp ? '#00A041' : '#EF4444',
          }}
        >
          <span className="text-[10px] leading-none">{trendUp ? '▲' : '▼'}</span>
          {trendValue}
        </span>
      </div>

      {/* Value */}
      <div className="mb-0.5 text-[28px] font-black leading-none tracking-tight text-[#0F1A0C] dark:text-[#F0EDD4]">
        {masked ? '••••' : value}
      </div>
      <div className="mb-4 text-[12px] font-medium text-[#888] dark:text-[#9A9A8A]">
        {label}
        <span className="ml-1.5 text-[#AAA] dark:text-[#A0A090]">- {trendLabel}</span>
      </div>
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
    period: { from: string; to: string; days: number };
    totals: { active_stations: number; total_clients: number; pending_kyc: number; open_support_tickets: number };
    metrics: { total_transactions: number; total_revenue: string; total_commissions: string };
    alerts: { pending_kyc: unknown[]; open_support_tickets: unknown[] };
  };
}

function fmtCurrency(v: string | number) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '0 $';
  return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function AdminKpiRow({ masked = false }: { masked?: boolean }) {
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
  const period = data?.period;
  const alerts = data?.alerts;
  const pendingKycCount = alerts?.pending_kyc?.length ?? totals?.pending_kyc ?? 0;
  const openTicketCount = alerts?.open_support_tickets?.length ?? totals?.open_support_tickets ?? 0;

  const cards: KpiCardProps[] = [
    { icon: <TransactionsIcon />, value: fmtCurrency(metrics?.total_revenue ?? '0'), label: t('kpi_revenue'), trendValue: `${period?.days ?? 0}d`, trendUp: true, trendLabel: t('kpi_period_label'), sparkline: [], accentColor: GOLD, animationDelay: '0ms', masked },
    { icon: <CommissionIcon />,   value: fmtCurrency(metrics?.total_commissions ?? '0'), label: t('kpi_commissions'), trendValue: String(metrics?.total_transactions ?? 0), trendUp: true, trendLabel: t('kpi_transactions_count'), sparkline: [], accentColor: GOLD, animationDelay: '60ms', masked },
    { icon: <MerchantsIcon />,    value: String(totals?.active_stations ?? 0), label: t('kpi_active_stations'), trendValue: String(pendingKycCount), trendUp: pendingKycCount > 0, trendLabel: t('kpi_pending_kyc_short'), sparkline: [], accentColor: '#3B82F6', animationDelay: '120ms', masked },
    { icon: <ClientsIcon />,      value: String(totals?.total_clients ?? 0), label: t('kpi_clients'), trendValue: String(openTicketCount), trendUp: openTicketCount > 0, trendLabel: t('kpi_support_short'), sparkline: [], accentColor: '#10B981', animationDelay: '180ms', masked },
    { icon: <PendingIcon />,      value: String(pendingKycCount), label: t('kpi_pending_kyc'), trendValue: 'live', trendUp: pendingKycCount > 0, trendLabel: t('kpi_live_data'), sparkline: [], accentColor: '#F59E0B', animationDelay: '240ms', masked },
    { icon: <TicketsIcon />,      value: String(openTicketCount), label: t('kpi_open_support_tickets'), trendValue: 'live', trendUp: openTicketCount > 0, trendLabel: t('kpi_live_data'), sparkline: [], accentColor: '#EF4444', animationDelay: '300ms', masked },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card, i) => (
        <KpiCard key={i} {...card} />
      ))}
    </div>
  );
}

const PendingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8M8 17h5" />
  </svg>
);

const TicketsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
