'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { StationReviews } from './StationReviews';
import { BookingFlow } from './booking/BookingFlow';
import { MOCK_STATIONS } from '@/data/stations-mock';
import type { StationDetailData, ServiceCategory, ServiceForfait } from '@/types/station';

interface StationDetailProps {
  id: string;
}

export function StationDetail({ id }: StationDetailProps) {
  const t = useTranslations('stations');

  const station: StationDetailData | undefined = useMemo(
    () => MOCK_STATIONS.find((s) => s.id === id),
    [id]
  );

  const [selectedCategoryIdx, setSelectedCategoryIdx] = useState(0);
  const [selectedForfaitIdx, setSelectedForfaitIdx] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);

  if (!station) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <p className="text-[16px] font-semibold text-[#000C1F] dark:text-[#FFF8EC]">{t('error_load')}</p>
        <Link href="/stations" className="text-[15px] font-semibold text-gold hover:text-gold-hover transition-colors">
          {t('back_to_list')}
        </Link>
      </div>
    );
  }

  const hasSlots = station.availableSlots > 0;
  const isOpen = station.isOpen !== false;
  const categories = station.serviceCategories || [];
  const currentCategory: ServiceCategory | undefined = categories[selectedCategoryIdx];
  const forfaits = currentCategory ? currentCategory.forfaits : [];
  const currentForfait: ServiceForfait | undefined = forfaits[selectedForfaitIdx];

  const handleCategoryChange = (idx: number) => {
    setSelectedCategoryIdx(idx);
    setSelectedForfaitIdx(0);
  };

  const mapsUrl = station.latitude && station.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.name}, ${station.address}, ${station.city}`)}`;

  return (
    <>
      <div className="min-h-screen bg-[#F5F5E6] dark:bg-dark-bg transition-colors animate-fade-in">
        {/* ── Hero ── */}
        <div className="relative h-[240px] sm:h-[320px] lg:h-[360px] bg-linear-to-br from-[#D5D5C5] to-[#EDEDED] dark:from-tab-inactive dark:to-dark-bg overflow-hidden">
          {station.imageUrl ? (
            <img src={station.imageUrl} alt={station.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#999] dark:text-[#3A4A36] text-[14px] font-semibold">
              Photo
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />

          <Link
            href="/stations"
            className="absolute top-3 left-3 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label={t('back_to_list')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>

          <button
            type="button"
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
            aria-label={t('detail_add_favorite')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>

          {/* Status badges on hero */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            {/* Open / Closed */}
            <span className={`px-3 py-1 rounded-full text-[13px] font-bold flex items-center gap-1.5 backdrop-blur-sm ${isOpen ? 'bg-lavo-success/20 text-lavo-success border border-lavo-success/30' : 'bg-lavo-error/20 text-lavo-error border border-lavo-error/30'}`}>
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-lavo-success animate-pulse' : 'bg-lavo-error'}`} />
              {isOpen ? t('status_open') : t('status_closed')}
            </span>
            {/* Verified */}
            {station.verified && (
              <span className="px-3 py-1 rounded-full bg-lavo-success/20 border border-lavo-success/30 text-lavo-success text-[13px] font-bold flex items-center gap-1.5 backdrop-blur-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {t('detail_verified')}
              </span>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-36 sm:pb-28 space-y-6">

          {/* Title + rating + meta */}
          <div>
            <h1 className="text-[24px] sm:text-[28px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-tight mb-2">
              {station.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[#555] dark:text-[#C0C0B0]">
              <span className="flex items-center gap-1">
                <span className="text-gold text-[16px]">&#9733;</span>
                <span className="text-[#000C1F] dark:text-[#FFF8EC] font-bold">{station.rating.toFixed(1)}</span>
                <span>({station.reviewCount} {t('reviews_count', { count: station.reviewCount }).replace(/\d+ /, '')})</span>
              </span>
              <span>&#183; {station.availableSlots} {t('places_dispo').toLowerCase()}</span>
              {station.openingHours && <span>&#183; {station.openingHours}</span>}
            </div>
          </div>

          {/* Service category selector */}
          {categories.length > 0 && (
            <div>
              <label className="block text-[13px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">
                {t('service_type')}
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map((cat, idx) => (
                  <button
                    key={cat.type}
                    type="button"
                    onClick={() => handleCategoryChange(idx)}
                    className={`shrink-0 px-4 py-2.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer ${
                      idx === selectedCategoryIdx
                        ? 'bg-gold text-dark-bg shadow-md'
                        : 'bg-[#E8E8D8] dark:bg-dark-card text-[#333] dark:text-[#C0C0B0] border border-[#D0D0C0] dark:border-tab-inactive hover:border-gold/40'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category description + forfaits */}
          {currentCategory && (
            <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl p-4 sm:p-5 transition-colors space-y-4">
              <p className="text-[14px] text-[#555] dark:text-[#B0B0A0] leading-relaxed">
                {currentCategory.description}
              </p>

              {/* Forfait cards */}
              <div className="grid gap-3">
                {forfaits.map((forfait, idx) => (
                  <button
                    key={forfait.id}
                    type="button"
                    onClick={() => setSelectedForfaitIdx(idx)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      idx === selectedForfaitIdx
                        ? 'border-gold bg-gold/10 dark:bg-gold/5'
                        : 'border-[#D0D0C0] dark:border-tab-inactive bg-white/40 dark:bg-dark-bg/40 hover:border-gold/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {idx === selectedForfaitIdx && (
                            <span className="w-5 h-5 rounded-full bg-gold flex items-center justify-center shrink-0">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </span>
                          )}
                          <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{forfait.name}</span>
                        </div>
                        <p className="text-[13px] text-[#555] dark:text-[#B0B0A0] line-clamp-2">{forfait.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[12px] text-[#888] dark:text-[#999] flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            {forfait.duration} min
                          </span>
                        </div>
                      </div>
                      <span className="text-[18px] font-black text-gold shrink-0">{forfait.price}$</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Queue banner */}
          {hasSlots && (
            <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl p-4 transition-colors">
              <div className="flex items-center gap-2 text-[13px] font-black text-[#000C1F] dark:text-[#FFF8EC] tracking-wider uppercase mb-3">
                <span className="w-2 h-2 rounded-full bg-lavo-success animate-pulse shrink-0" />
                {t('detail_queue')}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[22px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">{station.queueCount}</div>
                  <div className="text-[13px] text-[#555] dark:text-[#C0C0B0] mt-1">{t('queue_waiting')}</div>
                </div>
                <div>
                  <div className={`text-[22px] font-black leading-none ${station.estimatedWaitMinutes > 20 ? 'text-lavo-error' : 'text-[#000C1F] dark:text-[#FFF8EC]'}`}>
                    {station.estimatedWaitMinutes > 0 ? `${station.estimatedWaitMinutes}` : '\u2014'}
                  </div>
                  <div className="text-[13px] text-[#555] dark:text-[#C0C0B0] mt-1">Minutes</div>
                </div>
                <div>
                  <div className="text-[22px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">{station.availableSlots}</div>
                  <div className="text-[13px] text-[#555] dark:text-[#C0C0B0] mt-1">{t('queue_available')}</div>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {station.description && (
            <div>
              <h2 className="text-[18px] font-black text-[#000C1F] dark:text-[#FFF8EC] mb-2">{t('detail_description')}</h2>
              <p className="text-[15px] text-[#555] dark:text-[#C0C0B0] leading-[1.7]">{station.description}</p>
            </div>
          )}

          {/* Location */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-[#E8E8D8] dark:bg-dark-card rounded-xl px-4 py-4 transition-colors hover:border-gold/30 border border-[#D0D0C0] dark:border-tab-inactive group/loc"
          >
            <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-[#000C1F] dark:text-[#FFF8EC] truncate">{station.address}</div>
              <div className="text-[13px] text-[#555] dark:text-[#C0C0B0]">{station.city}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 group-hover/loc:translate-x-0.5 transition-transform">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>

          {/* Reviews */}
          <div>
            <h2 className="text-[16px] font-black text-[#000C1F] dark:text-[#FFF8EC] mb-3">
              {t('detail_reviews')} ({station.reviewCount})
            </h2>
            <StationReviews reviews={station.reviews} />
          </div>
        </div>

        {/* ── Sticky footer CTA ── */}
        <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 bg-[#F5F5E6]/95 dark:bg-dark-bg/95 backdrop-blur-md border-t border-[#D0D0C0] dark:border-tab-inactive px-4 py-3 z-40 transition-colors">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div>
              <div className="text-[20px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">
                {currentForfait ? currentForfait.price : station.priceFrom}
                <span className="text-[14px] font-semibold ml-1 text-[#555] dark:text-[#C0C0B0]">{t('price_unit')}</span>
              </div>
              <div className="text-[13px] text-[#555] dark:text-[#C0C0B0]">
                {currentForfait ? currentForfait.name : t('detail_price_from')}
              </div>
            </div>
            {hasSlots ? (
              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-[10px] text-[16px] font-black text-dark-bg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {t('continue')}
              </button>
            ) : (
              <div className="flex-1 py-3 bg-[#E0E0D0] dark:bg-tab-inactive rounded-[10px] text-[16px] font-bold text-[#444] dark:text-[#C0C0B0] text-center transition-colors">
                {t('no_slots')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking flow */}
      {bookingOpen && currentForfait && (
        <BookingFlow
          station={station}
          category={currentCategory!}
          forfait={currentForfait}
          onClose={() => setBookingOpen(false)}
        />
      )}
    </>
  );
}
