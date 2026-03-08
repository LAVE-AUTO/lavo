'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { postWithApi } from '@/services/axios-service';
import { useToast } from '@/context/toast-context';
import { Spinner } from '@/components/ui/Spinner';
import { useUserLocation, haversineKm } from './useUserLocation';
import type { StationDetailData } from '@/types/station';

interface StationCardProps {
  station: StationDetailData;
  unavailable?: boolean;
}

/**
 * Station card for the public list page.
 * Matches the result-card design from the HTML mockup:
 * dark card, photo, name/price row, rating, 3-col stats, tags, gold buttons.
 */
export function StationCard({ station, unavailable = false }: StationCardProps) {
  const t = useTranslations('stations');
  const { success, error } = useToast();
  const [joining, setJoining] = useState(false);
  const userLocation = useUserLocation();

  /* Compute distance from user to station */
  const distanceLabel = (() => {
    if (!userLocation || !station.latitude || !station.longitude) return null;
    const km = haversineKm(userLocation.latitude, userLocation.longitude, station.latitude, station.longitude);
    if (km < 1) return t('distance_m', { distance: Math.round(km * 1000) });
    return t('distance_km', { distance: km.toFixed(1) });
  })();

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
        'h-full flex flex-col bg-[#C8C8B4] dark:bg-dark-card rounded-[14px] overflow-hidden border border-[#CCCCCC] dark:border-tab-inactive group hover:border-gold/30 transition-all duration-300',
        unavailable ? 'opacity-50 grayscale pointer-events-none' : '',
      ].join(' ')}
    >
      {/* Photo area */}
      <div className="relative h-[140px] sm:h-[160px] bg-[#B8B8A4] dark:bg-tab-inactive flex items-center justify-center overflow-hidden">
        {station.imageUrl ? (
          <img
            src={station.imageUrl}
            alt={station.name}
            className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
          />
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l2-7h14l2 7" />
            <path d="M5 17v2h2v-2M17 17v2h2v-2" />
            <path d="M8 10V7a1 1 0 011-1h6a1 1 0 011 1v3" />
            <circle cx="7.5" cy="17" r="1.5" fill="#9A9A8A" />
            <circle cx="16.5" cy="17" r="1.5" fill="#9A9A8A" />
          </svg>
        )}

        {/* Gradient overlay at bottom with station name */}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-black/60 to-transparent pt-6 flex items-end px-3 pb-2 pointer-events-none">
          <span className="text-white text-[15px] font-bold leading-tight line-clamp-1 drop-shadow">
            {station.name}
          </span>
        </div>

        {unavailable && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-lavo-error/90 text-white text-[13px] font-bold tracking-wide">
            {t('no_slots')}
          </span>
        )}

        {!unavailable && distanceLabel && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[13px] font-bold flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {distanceLabel}
          </span>
        )}

        {station.verified && (
          <span className="absolute top-2 right-2 w-5 h-5 bg-lavo-success rounded-full flex items-center justify-center" title={t('detail_verified_label')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        {/* Name + price */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-[17px] font-bold text-[#0A0A14] dark:text-white leading-tight line-clamp-1">
            {station.name}
          </h3>
          <span className="text-[18px] font-bold text-gold shrink-0">
            {station.priceFrom.toLocaleString()} <span className="text-[13px] font-semibold">{t('price_unit')}</span>
          </span>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-3 text-[15px]">
          <span className="text-gold text-[17px]">★</span>
          <span className="text-[#0A0A14] dark:text-white font-semibold">{station.rating.toFixed(1)}</span>
          <span className="text-gold">({station.reviewCount} {t('reviews_count', { count: station.reviewCount }).replace(/\d+ /, '')})</span>
        </div>

        {/* Stats grid with dividers */}
        <div className="grid grid-cols-3 mb-3 text-center">
          <div className="border-r border-[#CCCCCC] dark:border-tab-inactive pr-2">
            <div className="text-[17px] font-black text-[#0A0A14] dark:text-white leading-none">{station.availableSlots}</div>
            <div className="text-[14px] text-[#111111] dark:text-[#D8D8C8] mt-1">{t('places_dispo')}</div>
          </div>
          <div className="border-r border-[#CCCCCC] dark:border-tab-inactive px-2">
            <div className="text-[17px] font-black text-[#0A0A14] dark:text-white leading-none">
              {station.estimatedWaitMinutes > 0 ? `${station.estimatedWaitMinutes}` : '\u2014'}
            </div>
            <div className="text-[14px] text-[#111111] dark:text-[#D8D8C8] mt-1">{t('min_attente')}</div>
          </div>
          <div className="pl-2">
            <div className="text-[17px] font-black text-[#0A0A14] dark:text-white leading-none">{station.services.length}</div>
            <div className="text-[14px] text-[#111111] dark:text-[#D8D8C8] mt-1">Services</div>
          </div>
        </div>

        {/* Tags */}
        {station.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {station.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="py-1 px-2.5 rounded-full text-[14px] font-bold bg-[#E8E8D8] dark:bg-tab-inactive text-[#000000] dark:text-[#F0F0E8] border border-[#D0D0C0] dark:border-tab-inactive"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto">
          {!unavailable && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="flex-1 py-2.5 border-2 border-gold rounded-lg text-[15px] font-bold text-gold text-center hover:bg-gold/10 transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
            >
              {joining ? <Spinner size="sm" /> : t('join')}
            </button>
          )}
          <Link
            href={`/stations/${station.id}`}
            className="flex-1 py-2.5 bg-gold hover:bg-gold-hover rounded-lg text-[15px] font-bold text-dark-bg text-center transition-colors"
          >
            {t('details')}
          </Link>
        </div>
      </div>
    </article>
  );
}
