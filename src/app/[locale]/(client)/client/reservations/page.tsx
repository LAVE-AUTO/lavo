'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MOCK_RESERVATIONS, MOCK_QUEUE_ENTRIES } from '@/data/reservations-mock';

type Tab = 'reservations' | 'queue';

export default function CouponsPage() {
  const t = useTranslations('coupons');
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>('reservations');

  const upcoming = useMemo(
    () => MOCK_RESERVATIONS.filter((r) => r.status === 'confirmed' || r.status === 'in_progress'),
    [],
  );
  const past = useMemo(
    () => MOCK_RESERVATIONS.filter((r) => r.status === 'completed' || r.status === 'cancelled'),
    [],
  );

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] pb-24 sm:pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <h1 className="text-[22px] font-black text-[#0A0A14] dark:text-white">{t('title')}</h1>
      </div>

      {/* Tabs */}
      <div className="px-4 max-w-2xl mx-auto">
        <div className="flex bg-[#E0E0D0] dark:bg-[#1A1A18] rounded-xl p-1 mb-6">
          {(['reservations', 'queue'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'flex-1 py-2.5 rounded-lg text-[14px] font-bold transition-all cursor-pointer',
                tab === key
                  ? 'bg-gold text-dark-bg shadow-sm'
                  : 'text-[#555] dark:text-[#B0B0A0] hover:text-[#0A0A14] dark:hover:text-white',
              ].join(' ')}
            >
              {t(`tab_${key}`)}
              <span className="ml-1.5 text-[12px] font-semibold opacity-70">
                ({key === 'reservations' ? MOCK_RESERVATIONS.length : MOCK_QUEUE_ENTRIES.length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 max-w-2xl mx-auto">
        {tab === 'reservations' ? (
          <div className="space-y-6">
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-[15px] font-black text-[#555] dark:text-[#B0B0A0] uppercase tracking-widest mb-3">
                  {t('upcoming')}
                </h2>
                <div className="space-y-3">
                  {upcoming.map((res) => (
                    <ReservationCard key={res.id} reservation={res} t={t} locale={locale} />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <section>
                <h2 className="text-[15px] font-black text-[#555] dark:text-[#B0B0A0] uppercase tracking-widest mb-3">
                  {t('past')}
                </h2>
                <div className="space-y-3">
                  {past.map((res) => (
                    <ReservationCard key={res.id} reservation={res} t={t} locale={locale} />
                  ))}
                </div>
              </section>
            )}

            {MOCK_RESERVATIONS.length === 0 && <EmptyState message={t('empty_reservations')} />}
          </div>
        ) : (
          <div className="space-y-3">
            {MOCK_QUEUE_ENTRIES.length > 0 ? (
              MOCK_QUEUE_ENTRIES.map((entry) => (
                <QueueCard key={entry.id} entry={entry} t={t} />
              ))
            ) : (
              <EmptyState message={t('empty_queue')} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/* ---- Reservation Card ---- */
function ReservationCard({ reservation: r, t, locale }: { reservation: typeof MOCK_RESERVATIONS[0]; t: ReturnType<typeof useTranslations>; locale: string }) {
  const dateObj = new Date(`${r.date}T${r.timeSlot}`);
  const dateLabel = dateObj.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });

  const statusColors: Record<string, string> = {
    confirmed: 'bg-lavo-success/15 text-lavo-success',
    in_progress: 'bg-gold/15 text-gold',
    completed: 'bg-[#999]/15 text-[#666]',
    cancelled: 'bg-lavo-error/15 text-lavo-error',
  };

  return (
    <Link
      href={`/client/reservations/${r.id}`}
      className="block bg-[#E8E8D8] dark:bg-[#1A1A18] rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4 hover:border-gold/30 transition-colors"
    >
      <div className="flex gap-3">
        {/* Image */}
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#D0D0C0] dark:bg-tab-inactive">
          {r.stationImageUrl && (
            <img src={r.stationImageUrl} alt={r.stationName} className="w-full h-full object-cover" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-bold text-[#0A0A14] dark:text-white leading-tight truncate">
              {r.stationName}
            </h3>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${statusColors[r.status] || 'bg-gray-200 text-gray-600'}`}>
              {t(`status_${r.status}`)}
            </span>
          </div>

          <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5">{r.forfaitName} - {r.categoryLabel}</p>

          <div className="flex items-center gap-3 mt-2 text-[13px]">
            <span className="flex items-center gap-1 text-[#555] dark:text-[#C0C0B0]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              {dateLabel}
            </span>
            <span className="flex items-center gap-1 text-[#555] dark:text-[#C0C0B0]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              {r.timeSlot}
            </span>
            <span className="ml-auto font-bold text-gold">{r.totalPrice}$</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ---- Queue Card ---- */
function QueueCard({ entry: q, t }: { entry: typeof MOCK_QUEUE_ENTRIES[0]; t: ReturnType<typeof useTranslations> }) {
  const isActive = q.status === 'in_progress';
  return (
    <div className="bg-[#E8E8D8] dark:bg-[#1A1A18] rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4">
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#D0D0C0] dark:bg-tab-inactive">
          {q.stationImageUrl && (
            <img src={q.stationImageUrl} alt={q.stationName} className="w-full h-full object-cover" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-bold text-[#0A0A14] dark:text-white leading-tight truncate">
              {q.stationName}
            </h3>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${isActive ? 'bg-gold/15 text-gold' : 'bg-blue-500/15 text-blue-500'}`}>
              {isActive ? t('queue_in_progress') : t('queue_waiting')}
            </span>
          </div>

          <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5">{q.forfaitName} - {q.categoryLabel}</p>

          <div className="flex items-center gap-3 mt-2 text-[13px]">
            <span className="flex items-center gap-1 text-[#555] dark:text-[#C0C0B0]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
              {t('queue_position', { position: q.position })}
            </span>
            <span className="flex items-center gap-1 text-gold font-semibold">
              ~{q.estimatedWaitMinutes} min
            </span>
            <span className="ml-auto font-bold text-gold">{q.totalPrice}$</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Empty state ---- */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#E0E0D0] dark:bg-[#1A1A18] flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9a2 2 0 012-2h16a2 2 0 012 2v1a2 2 0 010 4v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1a2 2 0 010-4V9z" />
          <path d="M9 7v10" strokeDasharray="2 2" />
        </svg>
      </div>
      <p className="text-[15px] text-[#555] dark:text-[#C0C0B0] max-w-xs">{message}</p>
    </div>
  );
}
