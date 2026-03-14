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
      <div className="relative rounded-xl border border-[#C49A1E] bg-[#FFFAE8] p-3.5 dark:bg-[#FFF8E0]">
        <div className="mb-2 flex items-center gap-1 text-[9px] font-black text-[#EF4444]">
          <span>&#9654;</span> {t('queue_next')}
        </div>
        <span
          className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9px] font-black text-white"
          style={{ background: tagBg }}
        >
          {tagLabel}
        </span>
        <div className="mb-0.5 text-[14px] font-black text-[#1A1A0A]">
          {entry.clientName}
        </div>
        {entry.time && entry.serviceLabel && (
          <div className="mb-2 text-[11px] text-[#555]">
            {entry.time} • {entry.serviceLabel}
            {entry.price ? ` • ${entry.price}$` : ''}
          </div>
        )}
        {entry.marginMin !== undefined && entry.marginMax !== undefined && (
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#555]">
            <div className="h-2 w-2 flex-shrink-0 rounded-full bg-[#2ECC71]" />
            <span>{t('queue_margin')}</span>
            <span className="font-bold text-[#2ECC71]">
              {t('queue_on_time')} ({entry.marginMin}/{entry.marginMax} min)
            </span>
            <div className="flex-1 rounded-full bg-[#DDD]" style={{ height: 4 }}>
              <div
                className="rounded-full bg-[#2ECC71]"
                style={{ height: 4, width: `${(entry.marginMin / entry.marginMax) * 100}%` }}
              />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => onCall(entry.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#C49A1E] py-2.5 text-[12px] font-black text-[#0C1209] transition-opacity hover:opacity-80"
        >
          <span>&#9654;</span> {t('queue_call_now')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl bg-[#EDE9CC] p-3.5 dark:bg-[#EDE9CC]">
      <span
        className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9px] font-black text-white"
        style={{ background: tagBg }}
      >
        {tagLabel}
      </span>
      <div className="mb-0.5 text-[12px] font-black text-[#8A8A7A]">
        {t('queue_position', { n: entry.position })}
      </div>
      <div className="mb-0.5 text-[14px] font-black text-[#1A1A0A]">
        {entry.clientName}
      </div>
      {(entry.time || entry.serviceLabel) && (
        <div className="text-[10px] text-[#777]">
          {entry.time} {entry.serviceLabel ? `• ${entry.serviceLabel}` : ''}
          {entry.price ? ` • ${entry.price}$` : ''}
          {entry.postLabel && <span className="ml-2 text-[#8A8A7A]">{entry.postLabel}</span>}
        </div>
      )}
    </div>
  );
}
