'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context';
import { useFavorites } from './useFavorites';
import { useUserLocation, haversineKm } from './useUserLocation';
import type { StationDetailData } from '@/types/station';

interface StationCardProps {
  station: StationDetailData;
  unavailable?: boolean;
}

/**
 * Station card for the public list page.
 * Shows distance from user, estimated wait, open/closed status, forfait tags, CTA.
 */
export function StationCard({ station, unavailable = false }: StationCardProps) {
  const t               = useTranslations('stations');
  const locale          = useLocale();
  const userLocation    = useUserLocation();
  const { isAuthenticated } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const [imgFailed, setImgFailed] = useState(false);

  const distanceLabel = (() => {
    const hasStationCoords =
      station.latitude != null && station.longitude != null &&
      (station.latitude !== 0 || station.longitude !== 0);
    const km = station.distanceKm != null
      ? station.distanceKm
      : (userLocation && hasStationCoords)
        ? haversineKm(userLocation.latitude, userLocation.longitude, station.latitude!, station.longitude!)
        : null;
    /* Regional service: an implausibly large distance means missing/placeholder
       coordinates, not a real position — show "--" rather than a misleading value. */
    if (km == null || km > 1000) return null;
    if (km < 1) return t('distance_m', { distance: Math.round(km * 1000) });
    return t('distance_km', { distance: km.toFixed(1) });
  })();

  const forfaitNames = station.serviceCategories
    ? [...new Set(station.serviceCategories.flatMap((c) => c.forfaits.map((f) => f.name)))]
    : station.tags;

  /* Name of the first available service shown in the card body (replaces the
   * duplicated station name). Falls back to the first forfait tag. */
  const primaryService = station.serviceFrom ?? forfaitNames[0] ?? null;

  /* Contextual status badge shown over the photo (replaces the distance badge -
   * distance stays in the stats row below). The "unavailable" prop forces the
   * no-availability state so the badge always matches the greyed-out card. */
  const statusBadge = (() => {
    const status = unavailable ? 'no_future_availability' : station.stationStatus;
    switch (status) {
      case 'open':
        return { labelKey: 'card_status_open', dot: 'bg-Hurryline-success', cls: 'bg-Hurryline-success/90 text-white' };
      case 'opening_soon':
        return { labelKey: 'card_status_opening_soon', dot: 'bg-white', cls: 'bg-blue-500/90 text-white' };
      case 'closing_soon':
        return { labelKey: 'card_status_closing_soon', dot: 'bg-dark-bg', cls: 'bg-gold text-dark-bg' };
      case 'closed':
        return { labelKey: 'card_status_closed', dot: 'bg-white/70', cls: 'bg-black/70 text-white' };
      case 'no_future_availability':
        return { labelKey: 'card_status_no_availability', dot: 'bg-white', cls: 'bg-Hurryline-error/90 text-white' };
      default:
        /* Fallback when the backend does not send a status: use the open flag. */
        return station.isOpen === false
          ? { labelKey: 'card_status_closed', dot: 'bg-white/70', cls: 'bg-black/70 text-white' }
          : { labelKey: 'card_status_open', dot: 'bg-Hurryline-success', cls: 'bg-Hurryline-success/90 text-white' };
    }
  })();

  return (
    <article
      className="h-full flex flex-col bg-surface rounded-[14px] overflow-hidden border border-border group hover:border-gold/30 transition-all duration-300"
    >
      {/* Photo */}
      <div
        className={[
          'relative h-[140px] sm:h-[160px] bg-[#D0D0C0] dark:bg-tab-inactive flex items-center justify-center overflow-hidden',
          unavailable ? 'grayscale' : '',
        ].join(' ')}
      >
        {station.imageUrl && !imgFailed ? (
          <img
            src={station.imageUrl}
            alt={station.name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
          />
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B0BFB1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l2-7h14l2 7" />
            <path d="M5 17v2h2v-2M17 17v2h2v-2" />
            <path d="M8 10V7a1 1 0 011-1h6a1 1 0 011 1v3" />
            <circle cx="7.5" cy="17" r="1.5" fill="#B0BFB1" />
            <circle cx="16.5" cy="17" r="1.5" fill="#B0BFB1" />
          </svg>
        )}

        <div className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-black/60 to-transparent pt-6 flex items-end px-3 pb-2 pointer-events-none">
          <span className="text-white text-[15px] font-bold leading-tight line-clamp-1 drop-shadow">
            {station.name}
          </span>
        </div>

        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[13px] font-bold tracking-wide flex items-center gap-1.5 ${statusBadge.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} aria-hidden="true" />
          {t(statusBadge.labelKey)}
        </span>

        <button
          type="button"
          onClick={() => toggle(station.id)}
          aria-label={isFavorite(station.id) ? t('detail_remove_favorite') : t('detail_add_favorite')}
          aria-pressed={isFavorite(station.id)}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60 cursor-pointer"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={isFavorite(station.id) ? '#DDAF3B' : 'none'}
            stroke={isFavorite(station.id) ? '#DDAF3B' : '#fff'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        {/* First available service + price (the station name lives on the photo overlay). */}
        {(primaryService || station.priceFrom != null) && (
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-[16px] font-bold text-foreground leading-tight line-clamp-1">
              {primaryService ?? ' '}
            </h3>
            {station.priceFrom != null && (
              <span className="text-[18px] font-bold text-gold shrink-0">
                <span className="text-[13px] font-semibold">{t('price_unit')}</span>{station.priceFrom.toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-3 text-[15px]">
          <span className="text-gold text-[17px]">&#9733;</span>
          <span className="text-foreground font-semibold">{station.rating.toFixed(1)}</span>
          <span className="text-gold">{t('reviews_count', { count: station.reviewCount })}</span>
        </div>

        {/* Stats grid: distance | wait */}
        <div className="grid grid-cols-2 mb-3 text-center">
          {/* Distance */}
          <div className="border-r border-border pr-2">
            <div className="text-[17px] font-black text-foreground leading-none truncate">
              {distanceLabel ?? '--'}
            </div>
            <div className="text-[13px] text-foreground/70 dark:text-[#D8D8C8] mt-1">{t('stat_distance')}</div>
          </div>

          {/* Min service duration */}
          <div className="pl-2">
            <div className="text-[17px] font-black text-foreground leading-none">
              {station.estimatedWaitMinutes > 0 ? `${station.estimatedWaitMinutes} min` : '0 min'}
            </div>
            <div className="text-[13px] text-foreground/70 dark:text-[#D8D8C8] mt-1">{t('min_attente')}</div>
          </div>
        </div>

        {/* Forfait tags */}
        {forfaitNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {forfaitNames.slice(0, 4).map((name) => (
              <span
                key={name}
                className="py-1 px-2.5 rounded-full text-[13px] font-bold bg-surface dark:bg-tab-inactive text-[#000000] dark:text-[#FFF9EC] border border-border"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto">
          <Link
            href={
              isAuthenticated
                ? `/stations/${station.id}`
                : `/login?callbackUrl=${encodeURIComponent(`/${locale ?? 'fr'}/stations/${station.id}`)}`
            }
            className="block w-full py-2.5 bg-gold hover:bg-gold-hover rounded-lg text-[15px] font-bold text-dark-bg text-center transition-colors"
          >
            {t('details')}
          </Link>
        </div>
      </div>
    </article>
  );
}
