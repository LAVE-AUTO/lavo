'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { postWithApi } from '@/services/axios-service';
import { useToast } from '@/context/toast-context';
import { Spinner } from '@/components/ui/Spinner';
import { StationReviews } from './StationReviews';
import { MOCK_STATIONS } from '@/data/stations-mock';
import type { StationDetailData } from '@/types/station';

interface StationDetailProps {
  id: string;
}

/**
 * Client-side station detail view.
 * Matches the detail screen design from the HTML mockup.
 * Uses static mock data (replace with GET /stations/:id when backend is ready).
 */
export function StationDetail({ id }: StationDetailProps) {
  const t = useTranslations('stations');
  const { success, error } = useToast();

  const station: StationDetailData | undefined = useMemo(
    () => MOCK_STATIONS.find((s) => s.id === id),
    [id]
  );

  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!station) return;
    setJoining(true);
    const [ok] = await postWithApi(`/stations/${id}/join`, {});
    setJoining(false);

    if (ok) {
      success(t('join_success'));
      const query = station.latitude && station.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.name}, ${station.address}`)}`;
      window.open(query, '_blank', 'noopener,noreferrer');
    } else {
      error(t('join_error'));
    }
  };

  if (!station) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <p className="text-[15px] font-semibold text-white">{t('error_load')}</p>
        <Link href="/stations" className="text-[14px] font-semibold text-gold hover:text-gold-hover transition-colors">
          {t('back_to_list')}
        </Link>
      </div>
    );
  }

  const hasSlots = station.availableSlots > 0;

  return (
    <div className="min-h-screen bg-[#1A2116] animate-fade-in">
      {/* ── Hero ── */}
      <div className="relative h-[180px] sm:h-[220px] bg-gradient-to-br from-[#2C3828] to-[#1A2116] overflow-hidden">
        {station.imageUrl ? (
          <img src={station.imageUrl} alt={station.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#3A4A36] text-[13px] font-semibold">
            Photo
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Back button */}
        <Link
          href="/stations"
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
          aria-label={t('back_to_list')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        {/* Favourite button (placeholder) */}
        <button
          type="button"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
          aria-label="Ajouter aux favoris"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>

        {/* Dots */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          <span className="w-4 h-1.5 rounded-sm bg-gold" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
        </div>
      </div>

      {/* ── Breadcrumb bar ── */}
      <div className="bg-[#1E2A1A] px-4 py-2 text-[10px] font-semibold text-[#9A9A8A]">
        <span>{station.address}</span>
        <span className="mx-1">·</span>
        <span>{station.city}</span>
        {station.openingHours && (
          <>
            <span className="mx-1">·</span>
            <span className="text-gold">{station.openingHours}</span>
          </>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="max-w-2xl mx-auto px-4 py-5 pb-36 sm:pb-24 space-y-4">

        {/* Title + meta */}
        <div>
          <div className="flex items-start gap-2 mb-1">
            <h1 className="text-[20px] font-black text-white leading-tight flex-1">
              {station.name}
            </h1>
            {station.verified && (
              <span className="shrink-0 mt-0.5 text-[10px] font-bold text-lavo-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-lavo-success inline-block" />
                Vérifié
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#9A9A8A]">
            <span className="text-gold">★</span>
            <span className="text-white font-semibold">{station.rating.toFixed(1)}</span>
            <span>({station.reviewCount} avis)</span>
            <span>·</span>
            <span>{station.availableSlots} places</span>
            {station.openingHours && (
              <>
                <span>·</span>
                <span>{station.openingHours}</span>
              </>
            )}
          </div>
        </div>

        {/* Price box */}
        <div className="bg-[#1E2A1A] rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[11px] text-[#9A9A8A] mb-1">{t('detail_price_from')}</div>
              {station.openingHours && (
                <div className="text-[12px] text-white">Horaires : {station.openingHours}</div>
              )}
            </div>
            <div className="text-[26px] font-black text-gold leading-none">
              {station.priceFrom.toLocaleString()}
              <span className="text-[13px] font-semibold ml-1">{t('price_unit')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#9A9A8A]">
            <span className="w-1.5 h-1.5 rounded-full bg-lavo-success shrink-0" />
            {hasSlots
              ? `${station.availableSlots} créneau(x) disponible(s)`
              : t('no_slots')
            }
            {station.estimatedWaitMinutes > 0 && (
              <>
                <span className="mx-0.5">·</span>
                <span>Attente estimée : {station.estimatedWaitMinutes} min</span>
              </>
            )}
          </div>
        </div>

        {/* Queue banner */}
        {hasSlots && (
          <div className="bg-[#1E2A1A] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[11px] font-black text-white tracking-wider uppercase mb-3">
              <span className="w-2 h-2 rounded-full bg-lavo-success animate-pulse shrink-0" />
              {t('detail_queue')}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[20px] font-black text-white">{station.queueCount}</div>
                <div className="text-[9px] text-[#9A9A8A]">{t('queue_waiting')}</div>
              </div>
              <div>
                <div className={`text-[20px] font-black ${station.estimatedWaitMinutes > 20 ? 'text-lavo-error' : 'text-white'}`}>
                  {station.estimatedWaitMinutes > 0 ? `${station.estimatedWaitMinutes}` : '—'}
                </div>
                <div className="text-[9px] text-[#9A9A8A]">Minutes</div>
              </div>
              <div>
                <div className="text-[20px] font-black text-white">{station.availableSlots}</div>
                <div className="text-[9px] text-[#9A9A8A]">{t('queue_available')}</div>
              </div>
            </div>
            {station.estimatedWaitMinutes > 0 && (
              <p className="text-[11px] text-[#9A9A8A] mt-3 leading-relaxed">
                Partez maintenant pour arriver <strong className="text-gold">pile au bon moment !</strong>
              </p>
            )}
          </div>
        )}

        {/* Description */}
        {station.description && (
          <div>
            <h2 className="text-[14px] font-black text-white mb-2">{t('detail_description')}</h2>
            <p className="text-[12px] text-[#9A9A8A] leading-relaxed">{station.description}</p>
          </div>
        )}

        {/* Services */}
        {station.services.length > 0 && (
          <div>
            <h2 className="text-[14px] font-black text-white mb-3">{t('detail_services')}</h2>
            <div className="space-y-2">
              {station.services.map((service) => (
                <div key={service} className="flex items-center gap-2 text-[12px] text-white">
                  <span className="text-lavo-success text-[14px] shrink-0">✓</span>
                  {service}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location box */}
        <div className="bg-[#1E2A1A] rounded-xl px-4 py-3 flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div>
            <div className="text-[13px] font-semibold text-white">{station.address}</div>
            <div className="text-[11px] text-[#9A9A8A]">{station.city}</div>
          </div>
        </div>

        {/* Reviews */}
        <div>
          <h2 className="text-[14px] font-black text-white mb-3">
            <span className="text-lavo-success mr-1">●</span>
            {t('detail_reviews')} ({station.reviewCount})
          </h2>
          <StationReviews reviews={station.reviews} dark />
        </div>
      </div>

      {/* ── Sticky footer CTA ── */}
      <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 bg-[#1A2116] border-t border-[#2C3828] px-4 py-3 flex items-center gap-3 z-40">
        <div>
          <div className="text-[18px] font-black text-white leading-none">
            {station.priceFrom.toLocaleString()}
            <span className="text-[11px] font-semibold ml-1 text-[#9A9A8A]">{t('price_unit')}</span>
          </div>
          <div className="text-[10px] text-[#9A9A8A]">{t('detail_price_from')}</div>
        </div>
        {hasSlots ? (
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="flex-1 py-3.5 bg-gold hover:bg-gold-hover disabled:opacity-70 rounded-[10px] text-[14px] font-black text-[#1A2116] transition-colors flex items-center justify-center gap-2"
          >
            {joining ? <><Spinner size="sm" /> {t('loading')}</> : t('detail_join')}
          </button>
        ) : (
          <div className="flex-1 py-3.5 bg-[#2C3828] rounded-[10px] text-[14px] font-bold text-[#9A9A8A] text-center">
            {t('no_slots')}
          </div>
        )}
      </div>
    </div>
  );
}
