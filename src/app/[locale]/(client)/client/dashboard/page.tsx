'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getFromApi } from '@/services/axios-service';
import { useAuth } from '@/context/auth-context';
import { useFavorites } from '@/components/stations/useFavorites';
import { PageSpinner } from '@/components/ui/PageSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface ApiEntry {
  status: string;
  amount_paid: string | null;
  created_at: string;
}

interface SupportTicketSummary {
  id: string;
  status: string;
}

export default function ClientDashboardPage() {
  const t = useTranslations('client_dashboard');
  const locale = useLocale();
  const { user, isLoading: authLoading } = useAuth();
  const { favoriteIds } = useFavorites();

  const [stats, setStats] = useState({
    completedCount: 0,
    totalSpent: 0,
    memberSince: null as string | null,
    openTickets: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const [entriesOk, entriesData] = await getFromApi('/me/entries?per_page=200');
      const [supportOk, supportData] = await getFromApi('/support');

      if (cancelled) return;

      const entries = entriesOk
        ? ((entriesData as { data?: { entries?: ApiEntry[] } })?.data?.entries ?? [])
        : [];
      const tickets = supportOk
        ? ((supportData as { data?: SupportTicketSummary[] })?.data ?? [])
        : [];

      let completedCount = 0;
      let totalSpent = 0;
      let memberSince: string | null = null;
      for (const entry of entries) {
        if (entry.status === 'completed') {
          completedCount += 1;
          const paid = Number.parseFloat(entry.amount_paid ?? '0');
          if (!Number.isNaN(paid)) totalSpent += paid;
          if (!memberSince || entry.created_at < memberSince) memberSince = entry.created_at;
        }
      }

      const openTickets = tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress').length;
      setStats({
        completedCount,
        totalSpent,
        memberSince,
        openTickets,
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  if (loading || authLoading) {
    return <PageSpinner py="py-24" />;
  }

  const memberSinceLabel = stats.memberSince
    ? new Date(stats.memberSince).toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
        month: 'short',
        year: 'numeric',
      })
    : t('empty_value');

  const totalSpentLabel = `${stats.totalSpent.toLocaleString(locale === 'en' ? 'en-CA' : 'fr-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} $`;

  return (
    <main className="min-h-screen bg-background pb-24 sm:pb-8">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-3xl border border-[rgba(200,152,10,0.12)] bg-surface">
          <div className="border-b border-[rgba(200,152,10,0.1)] px-5 py-5 sm:px-6">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/55 dark:text-foreground/65">{t('kicker')}</p>
            <h1 className="mt-2 text-[24px] font-black text-[#1a1a1a] dark:text-white sm:text-[30px]">
              {t('title', { name: user?.first_name ?? user?.email ?? '' })}
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] text-foreground/65 dark:text-[#A0A090]">{t('subtitle')}</p>
          </div>

          <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
            <SummaryCard label={t('stat_washes')} value={String(stats.completedCount)} helper={t('stat_washes_hint')} />
            <SummaryCard label={t('stat_spent')} value={totalSpentLabel} helper={t('stat_spent_hint')} />
            <SummaryCard label={t('stat_tickets')} value={String(stats.openTickets)} helper={t('stat_tickets_hint')} />
            <SummaryCard label={t('stat_favorites')} value={String(favoriteIds.length)} helper={t('stat_favorites_hint')} />
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-[rgba(200,152,10,0.12)] bg-white p-5 dark:bg-surface sm:p-6">
            <h2 className="text-[16px] font-black text-[#1a1a1a] dark:text-white">{t('shortcuts_title')}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ShortcutLink href="/stations" label={t('shortcut_stations')} desc={t('shortcut_stations_desc')} />
              <ShortcutLink href="/client/reservations" label={t('shortcut_reservations')} desc={t('shortcut_reservations_desc')} />
              <ShortcutLink href="/client/history" label={t('shortcut_history')} desc={t('shortcut_history_desc')} />
              <ShortcutLink href="/client/support" label={t('shortcut_support')} desc={t('shortcut_support_desc')} />
              <ShortcutLink href="/favorites" label={t('shortcut_favorites')} desc={t('shortcut_favorites_desc')} />
              <ShortcutLink href="/profile" label={t('shortcut_profile')} desc={t('shortcut_profile_desc')} />
            </div>
          </div>

          <div className="rounded-3xl border border-[rgba(200,152,10,0.12)] bg-white p-5 dark:bg-surface sm:p-6">
            <h2 className="text-[16px] font-black text-[#1a1a1a] dark:text-white">{t('account_title')}</h2>
            <div className="mt-4 space-y-3 text-[14px]">
              <InfoRow label={t('account_email')} value={user?.email ?? '-'} />
              <InfoRow label={t('account_member_since')} value={memberSinceLabel} />
              <InfoRow label={t('account_verified')} value={user?.email_verified_at ? t('yes') : t('no')} />
            </div>
            <div className="mt-5 rounded-2xl bg-gold/10 px-4 py-4 text-[13px] text-[#4E2507] dark:text-foreground">
              {t('account_hint')}
            </div>
          </div>
        </section>

        {stats.completedCount === 0 && stats.openTickets === 0 && favoriteIds.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title={t('empty_title')}
              description={t('empty_desc')}
              action={
                <Link
                  href="/stations"
                  className="inline-flex items-center justify-center rounded-xl bg-gold px-5 py-3 text-[14px] font-black text-dark-bg transition-colors hover:bg-gold-hover"
                >
                  {t('empty_cta')}
                </Link>
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[rgba(200,152,10,0.12)] bg-[#F7F6F2] px-4 py-4 dark:bg-[#111A0E]">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/55 dark:text-foreground/65">{label}</p>
      <p className="mt-2 text-[22px] font-black text-[#1a1a1a] dark:text-white">{value}</p>
      <p className="mt-1 text-[12px] text-foreground/65 dark:text-[#A0A090]">{helper}</p>
    </div>
  );
}

function ShortcutLink({
  href,
  label,
  desc,
}: {
  href: Parameters<typeof Link>[0]['href'];
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#E0E0D0] bg-[#F7F6F2] px-4 py-4 transition-colors hover:border-gold/30 hover:bg-gold/5 dark:border-border dark:bg-[#111A0E]"
    >
      <p className="text-[14px] font-black text-[#1a1a1a] transition-colors group-hover:text-gold dark:text-white">{label}</p>
      <p className="mt-1 text-[12px] text-foreground/65 dark:text-[#A0A090]">{desc}</p>
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F7F6F2] px-4 py-3 text-[13px] dark:bg-[#111A0E]">
      <span className="font-semibold text-foreground/65 dark:text-[#A0A090]">{label}</span>
      <span className="font-bold text-[#1a1a1a] dark:text-white">{value}</span>
    </div>
  );
}
