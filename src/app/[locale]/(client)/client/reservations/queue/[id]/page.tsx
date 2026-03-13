'use client';

import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MOCK_QUEUE_ENTRIES } from '@/data/reservations-mock';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

/* Simulate real-time position by randomly decrementing every 30s */
function useRealtimePosition(initial: number) {
  const [position, setPosition] = useState(initial);

  useEffect(() => {
    if (position <= 1) return;
    const id = setInterval(() => {
      setPosition((p) => (p > 1 ? p - 1 : p));
    }, 30_000);
    return () => clearInterval(id);
  }, [position]);

  return position;
}

export default function QueueDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const t = useTranslations('queue_detail');

  const entry = MOCK_QUEUE_ENTRIES.find((q) => q.id === id);
  if (!entry) notFound();

  const position = useRealtimePosition(entry.position);
  const waitMinutes = Math.max(1, Math.round(position * (entry.estimatedWaitMinutes / entry.position)));
  const isActive = entry.status === 'in_progress';

  const mapsUrl =
    entry.stationLatitude != null && entry.stationLongitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${entry.stationLatitude},${entry.stationLongitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${entry.stationName}, ${entry.stationAddress}`)}`;

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-dark-bg pb-24 sm:pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto flex items-center gap-3">
        <Link
          href="/client/reservations"
          className="w-9 h-9 rounded-full bg-[#E8E8D8] dark:bg-dark-card flex items-center justify-center hover:bg-[#D0D0C0] dark:hover:bg-tab-inactive transition-colors"
          aria-label={t('back')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
        <h1 className="text-[20px] font-black text-[#0A0A14] dark:text-white">{t('title')}</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4">

        {/* Station card */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive overflow-hidden">
          {entry.stationImageUrl && (
            <div className="h-[140px] overflow-hidden">
              <img src={entry.stationImageUrl} alt={entry.stationName} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-4">
            <h2 className="text-[17px] font-black text-[#0A0A14] dark:text-white">{entry.stationName}</h2>
            <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5">{entry.stationAddress}</p>
            <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-1">{entry.forfaitName} — {entry.categoryLabel}</p>
          </div>
        </div>

        {/* Live position panel */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'bg-gold animate-pulse' : 'bg-lavo-success animate-pulse'}`} />
            <span className="text-[12px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider">
              {isActive ? t('status_in_progress') : t('status_waiting')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            {/* Position */}
            <div className="bg-white/50 dark:bg-dark-bg/40 rounded-xl py-5">
              <div className="text-[44px] font-black text-gold leading-none">#{position}</div>
              <div className="text-[13px] text-[#555] dark:text-[#B0B0A0] mt-2 font-semibold">{t('your_position')}</div>
            </div>

            {/* Wait time */}
            <div className="bg-white/50 dark:bg-dark-bg/40 rounded-xl py-5">
              <div className="text-[44px] font-black text-[#0A0A14] dark:text-white leading-none">{waitMinutes}</div>
              <div className="text-[13px] text-[#555] dark:text-[#B0B0A0] mt-2 font-semibold">{t('wait_minutes')}</div>
            </div>
          </div>

          {position === 1 && (
            <div className="mt-4 px-4 py-3 bg-lavo-success/10 border border-lavo-success/30 rounded-xl text-center">
              <span className="text-[14px] font-bold text-lavo-success">{t('next_up')}</span>
            </div>
          )}
        </div>

        {/* Service summary */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4 space-y-2">
          <h3 className="text-[14px] font-black text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-3">{t('summary')}</h3>

          <div className="flex justify-between text-[14px]">
            <span className="text-[#555] dark:text-[#B0B0A0]">{t('service')}</span>
            <span className="font-bold text-[#0A0A14] dark:text-white">{entry.forfaitName}</span>
          </div>

          {entry.extras.length > 0 && (
            <div className="flex justify-between text-[14px]">
              <span className="text-[#555] dark:text-[#B0B0A0]">{t('extras')}</span>
              <span className="font-bold text-[#0A0A14] dark:text-white text-right max-w-[60%]">{entry.extras.join(', ')}</span>
            </div>
          )}

          <div className="flex justify-between text-[14px] pt-2 border-t border-[#D0D0C0] dark:border-tab-inactive">
            <span className="font-bold text-[#0A0A14] dark:text-white">{t('total')}</span>
            <span className="text-[17px] font-black text-gold">{entry.totalPrice}$</span>
          </div>
        </div>

        {/* Google Maps CTA */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {t('open_maps')}
        </a>
      </div>
    </main>
  );
}
