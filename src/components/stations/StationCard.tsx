'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { postWithApi } from '@/services/axios-service';
import { useToast } from '@/context/toast-context';
import { StarRating } from '@/components/ratings/StarRating';
import { Spinner } from '@/components/ui/Spinner';
import type { Station } from '@/types/station';

interface StationCardProps {
  station: Station;
  unavailable?: boolean;
}

function MapPinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/**
 * Station card for the public list page.
 * Displays station info, rating, available slots, tags, and action buttons.
 * When unavailable (no slots), the card is grayed and the Join button is hidden.
 */
export function StationCard({ station, unavailable = false }: StationCardProps) {
  const t = useTranslations('stations');
  const { success, error } = useToast();
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    setJoining(true);
    const [ok] = await postWithApi(`/stations/${station.id}/join`, {});
    setJoining(false);

    if (ok) {
      success(t('join_success'));
      if (station.latitude && station.longitude) {
        window.open(
          `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`,
          '_blank',
          'noopener,noreferrer'
        );
      } else {
        const encoded = encodeURIComponent(`${station.name}, ${station.address}, ${station.city}`);
        window.open(
          `https://www.google.com/maps/search/?api=1&query=${encoded}`,
          '_blank',
          'noopener,noreferrer'
        );
      }
    } else {
      error(t('join_error'));
    }
  };

  return (
    <article
      className={[
        'bg-white dark:bg-dark-card rounded-2xl overflow-hidden shadow-sm border border-[#EBEBDF] dark:border-[#2C3828] transition-shadow duration-200',
        unavailable ? 'opacity-50 grayscale' : 'hover:shadow-md',
      ].join(' ')}
      aria-disabled={unavailable}
    >
      {/* Station image */}
      <div className="relative h-[120px] bg-gradient-to-br from-[#2C3828] to-[#1A2116] dark:from-[#243020] dark:to-[#1A2116] flex items-center justify-center overflow-hidden">
        {station.imageUrl ? (
          <img
            src={station.imageUrl}
            alt={station.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3A4A36" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l2-7h14l2 7" />
            <path d="M5 17v2h2v-2M17 17v2h2v-2" />
            <path d="M8 10V7a1 1 0 011-1h6a1 1 0 011 1v3" />
            <circle cx="7.5" cy="17" r="1.5" fill="#3A4A36" />
            <circle cx="16.5" cy="17" r="1.5" fill="#3A4A36" />
          </svg>
        )}

        {unavailable && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-lavo-error text-white text-[10px] font-bold tracking-wide">
            {t('no_slots')}
          </span>
        )}

        {!unavailable && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-lavo-success/90 text-white text-[10px] font-bold">
            {t('available_slots', { count: station.availableSlots })}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-[15px] font-bold text-[#1A1A1A] dark:text-white leading-tight line-clamp-1">
            {station.name}
          </h3>
          <span className="text-[15px] font-bold text-gold shrink-0">
            {station.priceFrom.toLocaleString()} {t('price_unit')}
          </span>
        </div>

        <p className="flex items-center gap-1 text-[12px] text-lavo-muted mb-2 line-clamp-1">
          <MapPinIcon />
          {station.address}, {station.city}
        </p>

        <div className="flex items-center gap-2 mb-3">
          <StarRating value={station.rating} />
          <span className="text-[12px] text-lavo-muted">
            {station.rating.toFixed(1)} · {t('reviews_count', { count: station.reviewCount })}
          </span>
        </div>

        {station.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {station.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0F0E8] dark:bg-[#2C3828] text-[#444] dark:text-lavo-muted border border-[#E0E0D0] dark:border-[#3A4A36]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Link
            href={`/stations/${station.id}`}
            className="flex-1 py-2.5 border border-gold rounded-[8px] text-[12px] font-bold text-gold text-center hover:bg-gold/5 transition-colors"
          >
            {t('details')}
          </Link>

          {!unavailable && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="flex-1 py-2.5 bg-gold hover:bg-gold-hover disabled:opacity-70 rounded-[8px] text-[12px] font-bold text-[#1A2116] transition-colors flex items-center justify-center gap-1.5"
            >
              {joining ? <Spinner size="sm" /> : t('join')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
