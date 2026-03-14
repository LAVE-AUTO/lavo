'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/auth-context';

interface StationTopNavProps {
  stationName?: string;
  notifCount?: number;
}

export function StationTopNav({ stationName, notifCount = 0 }: StationTopNavProps) {
  const t = useTranslations('station_dashboard');
  const { user } = useAuth();

  const displayName = stationName ?? user?.first_name ?? 'Station';

  return (
    <header
      className="flex h-14 flex-shrink-0 items-center justify-between border-b px-6"
      style={{ background: '#111A0E', borderColor: '#1A2A14' }}
    >
      {/* Logo + station name */}
      <div>
        <div
          className="font-playfair text-[22px] font-black leading-none tracking-[-0.02em]"
          style={{ color: '#C49A1E' }}
        >
          Slowtime
        </div>
        <div className="mt-0.5 text-[10px] font-medium" style={{ color: '#8A8A7A' }}>
          {displayName}
        </div>
      </div>

      {/* Notification bell */}
      <button
        type="button"
        aria-label={t('notif_tooltip')}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:opacity-80"
        style={{ background: '#182214' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {notifCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white"
            style={{ background: '#EF4444' }}
          >
            {notifCount > 9 ? '9+' : notifCount}
          </span>
        )}
      </button>
    </header>
  );
}
