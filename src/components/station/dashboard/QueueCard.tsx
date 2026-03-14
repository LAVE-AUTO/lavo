'use client';

import { useTranslations } from 'next-intl';

export interface QueueEntry {
  id: string;
  position: number;
  clientName: string;
  entryType: 'reservation' | 'queue';
  time?: string;
  serviceLabel?: string;
  price?: number;
  postLabel?: string;
  marginMin?: number;
  marginMax?: number;
  isNext: boolean;
}

interface QueueCardProps {
  entry: QueueEntry;
  onCall: (id: string) => void;
}

export function QueueCard({ entry, onCall }: QueueCardProps) {
  const t = useTranslations('station_dashboard');

  const isReservation = entry.entryType === 'reservation';
  const tagLabel = isReservation ? t('queue_tag_reserved') : t('queue_tag_app');
  const tagBg = isReservation ? '#2ECC71' : '#3B82F6';

  if (entry.isNext) {
    return (
      <div className="relative rounded-xl p-3.5" style={{ background: '#FFF8E0', border: '1.5px solid #C49A1E' }}>
        <div className="mb-2 flex items-center gap-1 text-[9px] font-black" style={{ color: '#EF4444' }}>
          <span>&#9654;</span> {t('queue_next')}
        </div>
        <span
          className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9px] font-black text-white"
          style={{ background: tagBg }}
        >
          {tagLabel}
        </span>
        <div className="mb-0.5 text-[14px] font-black" style={{ color: '#1A1A0A' }}>
          {entry.clientName}
        </div>
        {entry.time && entry.serviceLabel && (
          <div className="mb-2 text-[11px]" style={{ color: '#555' }}>
            {entry.time} • {entry.serviceLabel}
            {entry.price ? ` • ${entry.price}$` : ''}
          </div>
        )}
        {entry.marginMin !== undefined && entry.marginMax !== undefined && (
          <div className="mb-2 flex items-center gap-2 text-[10px]" style={{ color: '#555' }}>
            <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: '#2ECC71' }} />
            <span>{t('queue_margin')}</span>
            <span className="font-bold" style={{ color: '#2ECC71' }}>
              {t('queue_on_time')} ({entry.marginMin}/{entry.marginMax} min)
            </span>
            <div className="flex-1 rounded-full" style={{ height: 4, background: '#DDD' }}>
              <div
                className="rounded-full"
                style={{ height: 4, width: `${(entry.marginMin / entry.marginMax) * 100}%`, background: '#2ECC71' }}
              />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => onCall(entry.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[12px] font-black transition-opacity hover:opacity-80"
          style={{ background: '#C49A1E', color: '#0C1209' }}
        >
          <span>&#9654;</span> {t('queue_call_now')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl p-3.5" style={{ background: '#EDE9CC' }}>
      <span
        className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9px] font-black text-white"
        style={{ background: tagBg }}
      >
        {tagLabel}
      </span>
      <div className="mb-0.5 text-[12px] font-black" style={{ color: '#8A8A7A' }}>
        {t('queue_position', { n: entry.position })}
      </div>
      <div className="mb-0.5 text-[14px] font-black" style={{ color: '#1A1A0A' }}>
        {entry.clientName}
      </div>
      {(entry.time || entry.serviceLabel) && (
        <div className="text-[10px]" style={{ color: '#777' }}>
          {entry.time} {entry.serviceLabel ? `• ${entry.serviceLabel}` : ''}
          {entry.price ? ` • ${entry.price}$` : ''}
          {entry.postLabel && <span className="ml-2" style={{ color: '#8A8A7A' }}>{entry.postLabel}</span>}
        </div>
      )}
    </div>
  );
}
