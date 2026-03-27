'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSearchParams, useRouter } from 'next/navigation';
import { StationReviews } from './StationReviews';
import { BookingFlow } from './booking/BookingFlow';
import { fetchStationById } from '@/services/station-api';
import { useFavorites } from './useFavorites';
import { PageSpinner } from '@/components/ui/PageSpinner';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { postWithApi } from '@/services/axios-service';
import type { StationDetailData, ServiceCategory, ServiceForfait } from '@/types/station';

interface StationDetailProps {
  id: string;
}

function normalizeQrContext(searchParams: ReturnType<typeof useSearchParams>): {
  qrToken: string | null;
  qrVersion: '1' | null;
} {
  const rawToken = searchParams.get('qr_token');
  const rawVersion = searchParams.get('v');
  const qrToken = typeof rawToken === 'string' && /^[a-f0-9]{64}$/i.test(rawToken) ? rawToken : null;
  const qrVersion = rawVersion === '1' ? '1' : null;
  if (!qrToken || !qrVersion) {
    return { qrToken: null, qrVersion: null };
  }
  return { qrToken, qrVersion };
}

export function StationDetail({ id }: StationDetailProps) {
  const t = useTranslations('stations');
  const { isFavorite, toggle } = useFavorites();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { qrToken, qrVersion } = normalizeQrContext(searchParams);
  const { success: toastSuccess, error: toastError } = useToast();
  const { isAuthenticated } = useAuth();
  const locale = useLocale();
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, [mountedRef]);

  const [station, setStation] = useState<StationDetailData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchStationById(id).then((result) => {
      if (!cancelled) setStation(result);
    }).catch(() => {
      if (!cancelled) setStation(null);
    });
    return () => { cancelled = true; };
  }, [id]);

  const [selectedCategoryIdx, setSelectedCategoryIdx] = useState(0);
  const [selectedForfaitIdx, setSelectedForfaitIdx] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [joiningQueue, setJoiningQueue] = useState(false);

  if (station === undefined) return <PageSpinner />;

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
  const isOpen   = station.isOpen !== false;
  const categories = station.serviceCategories || [];
  const currentCategory: ServiceCategory | undefined = categories[selectedCategoryIdx];
  const forfaits = currentCategory ? currentCategory.forfaits : [];
  const currentForfait: ServiceForfait | undefined = forfaits[selectedForfaitIdx];

  const handleCategoryChange = (idx: number) => {
    setSelectedCategoryIdx(idx);
    setSelectedForfaitIdx(0);
  };

  const handleJoinQueue = async () => {
    if (!isAuthenticated) {
      const callbackUrl = encodeURIComponent(`/stations/${id}`);
      router.push(`/${locale ?? 'fr'}/login?callbackUrl=${callbackUrl}`);
      return;
    }
    if (!currentForfait) return;
    setJoiningQueue(true);
    const [ok] = await postWithApi(`/stations/${id}/queue/join`, { vehicle_format_id: currentForfait.id });
    if (!mountedRef.current) return;
    setJoiningQueue(false);
    if (ok) {
      toastSuccess(t('detail_queue_joined'));
    } else {
      toastError(t('detail_queue_join_error'));
    }
  };

  const mapsUrl =
    station.latitude != null && station.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.name}, ${station.address}, ${station.city}`)}`;

  /* ── Reusable booking widget (rendered in sidebar on lg, inline on mobile) ── */
  const BookingWidget = (
    <div className="space-y-5">
      {/* Price + status row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[24px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">
            {currentForfait ? currentForfait.price : station.priceFrom}
            <span className="text-[14px] font-semibold ml-1 text-[#555] dark:text-[#C0C0B0]">{t('price_unit')}</span>
          </div>
          <div className="text-[13px] text-[#555] dark:text-[#C0C0B0] mt-0.5">
            {currentForfait ? currentForfait.name : t('detail_price_from')}
          </div>
        </div>
        <Badge variant={isOpen ? 'status-open' : 'status-closed'} className="px-3 py-1 text-[13px]">
          <span className={`w-2 h-2 rounded-full mr-1.5 ${isOpen ? 'bg-lavo-success animate-pulse' : 'bg-lavo-error'}`} />
          {isOpen ? t('status_open') : t('status_closed')}
        </Badge>
      </div>

      {/* Slot picker — shown when available slots OR station is open (for queue join) */}
      {(hasSlots || isOpen) && categories.length > 0 && (
        <div>
          <label className="block text-[11px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">
            {t('service_type')}
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat, idx) => (
              <button
                key={cat.type}
                type="button"
                onClick={() => handleCategoryChange(idx)}
                className={`shrink-0 px-3 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${
                  idx === selectedCategoryIdx
                    ? 'bg-gold text-dark-bg shadow-md'
                    : 'bg-[#F0F0E2] dark:bg-tab-inactive text-[#333] dark:text-[#C0C0B0] border border-[#D0D0C0] dark:border-tab-inactive hover:border-gold/40'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Forfait cards — shown when available slots OR station is open (for queue join) */}
      {(hasSlots || isOpen) && currentCategory && (
        <div className="space-y-3">
          {currentCategory.description && (
            <p className="text-[13px] text-[#555] dark:text-[#B0B0A0] leading-relaxed">
              {currentCategory.description}
            </p>
          )}
          <div className="space-y-2.5 max-h-[280px] overflow-y-auto scrollbar-hide pr-0.5">
            {forfaits.map((forfait, idx) => (
              <button
                key={forfait.id}
                type="button"
                onClick={() => setSelectedForfaitIdx(idx)}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  idx === selectedForfaitIdx
                    ? 'border-gold bg-gold/10 dark:bg-gold/5'
                    : 'border-[#D0D0C0] dark:border-tab-inactive bg-white/40 dark:bg-dark-bg/40 hover:border-gold/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {idx === selectedForfaitIdx && (
                        <span className="w-4 h-4 rounded-full bg-gold flex items-center justify-center shrink-0">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </span>
                      )}
                      <span className="text-[14px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{forfait.name}</span>
                    </div>
                    <p className="text-[12px] text-[#555] dark:text-[#B0B0A0] line-clamp-2">{forfait.description}</p>
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-[#888] dark:text-[#999]">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      {forfait.duration} min
                    </span>
                  </div>
                  <span className="text-[17px] font-black text-gold shrink-0">{forfait.price}$</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unavailable notice — shown when station is closed and has no available slots */}
      {!hasSlots && !isOpen && (
        <div className="rounded-xl border border-[#D0D0C0] dark:border-tab-inactive bg-[#F0F0E2] dark:bg-dark-bg/50 px-4 py-4 text-[14px] text-[#555] dark:text-[#B0B0A0] text-center leading-relaxed">
          {t('detail_unavailable_notice')}
        </div>
      )}

      {/* Queue stats */}
      {hasSlots && (
        <div className="bg-[#F0F0E2] dark:bg-dark-bg/50 rounded-xl p-3.5 border border-[#D8D8C8] dark:border-tab-inactive">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-[#555] dark:text-[#A0A090] tracking-wider uppercase mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-lavo-success animate-pulse shrink-0" />
            {t('detail_queue')}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[20px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">{station.queueCount}</div>
              <div className="text-[11px] text-[#555] dark:text-[#C0C0B0] mt-1">{t('queue_waiting')}</div>
            </div>
            <div>
              <div className={`text-[20px] font-black leading-none ${station.estimatedWaitMinutes > 20 ? 'text-lavo-error' : 'text-[#000C1F] dark:text-[#FFF8EC]'}`}>
                {station.estimatedWaitMinutes > 0 ? station.estimatedWaitMinutes : '—'}
              </div>
              <div className="text-[11px] text-[#555] dark:text-[#C0C0B0] mt-1">{t('min_attente')}</div>
            </div>
            <div>
              <div className="text-[20px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">{station.availableSlots}</div>
              <div className="text-[11px] text-[#555] dark:text-[#C0C0B0] mt-1">{t('queue_available')}</div>
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      {hasSlots ? (
        <button
          type="button"
          onClick={() => setBookingOpen(true)}
          className="w-full py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors cursor-pointer btn-shine"
        >
          {t('continue')}
        </button>
      ) : isOpen && currentForfait ? (
        <button
          type="button"
          onClick={handleJoinQueue}
          disabled={joiningQueue}
          aria-busy={joiningQueue}
          className="w-full py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors cursor-pointer btn-shine disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {joiningQueue ? '...' : t('detail_join_queue')}
        </button>
      ) : (
        <div className="w-full py-3.5 bg-[#E0E0D0] dark:bg-tab-inactive rounded-xl text-[15px] font-bold text-[#444] dark:text-[#C0C0B0] text-center">
          {t('no_slots')}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-[#F5F5E6] dark:bg-dark-bg transition-colors animate-fade-in">

        {/* ── Hero — full width ── */}
        <div className="relative h-[240px] sm:h-[320px] lg:h-[440px] bg-linear-to-br from-[#D5D5C5] to-[#EDEDED] dark:from-tab-inactive dark:to-dark-bg overflow-hidden">
          {station.imageUrl ? (
            <img src={station.imageUrl} alt={station.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#999] dark:text-[#3A4A36] text-[14px] font-semibold">
              Photo
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

          {/* Back button */}
          <Link
            href="/stations"
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label={t('back_to_list')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>

          {/* Favorite button */}
          <button
            type="button"
            onClick={() => toggle(id)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
            aria-label={isFavorite(id) ? t('detail_remove_favorite') : t('detail_add_favorite')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isFavorite(id) ? '#C49A1E' : 'none'} stroke={isFavorite(id) ? '#C49A1E' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>

          {/* Bottom info overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-5 pt-12">
            <div className="max-w-[1440px] mx-auto">
              <h1 className="text-[26px] sm:text-[32px] lg:text-[38px] font-black text-white leading-tight drop-shadow mb-2">
                {station.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="flex items-center gap-1.5 text-white/90 text-[14px]">
                  <span className="text-gold text-[16px]">&#9733;</span>
                  <span className="font-bold">{station.rating.toFixed(1)}</span>
                  <span className="opacity-80">{t('reviews_count', { count: station.reviewCount })}</span>
                </span>
                {station.verified && (
                  <Badge variant="verified" className="backdrop-blur-sm border border-gold/40 px-2.5 py-0.5 text-[12px]">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="20 6 9 17 4 12" /></svg>
                    {t('detail_verified')}
                  </Badge>
                )}
                {station.openingHours && (
                  <span className="text-white/80 text-[13px]">&#183; {station.openingHours}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-16 py-8 pb-36 sm:pb-28 lg:pb-14">
          <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-12 lg:items-start">

            {/* ── Left column ── */}
            <div className="space-y-7">

              {/* Booking widget — mobile/tablet only, below title */}
              <div className="lg:hidden">
                <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-2xl p-5 border border-[#D0D0C0] dark:border-tab-inactive">
                  {BookingWidget}
                </div>
              </div>

              {/* Description */}
              {station.description && (
                <div>
                  <h2 className="text-[17px] font-black text-[#000C1F] dark:text-[#FFF8EC] mb-2">{t('detail_description')}</h2>
                  <p className="text-[15px] text-[#555] dark:text-[#C0C0B0] leading-[1.75]">{station.description}</p>
                </div>
              )}

              {/* Location */}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 bg-[#E8E8D8] dark:bg-dark-card rounded-xl px-5 py-4 transition-colors hover:border-gold/40 border border-[#D0D0C0] dark:border-tab-inactive group/loc"
              >
                <div className="w-11 h-11 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
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
                <h2 className="text-[17px] font-black text-[#000C1F] dark:text-[#FFF8EC] mb-4">
                  {t('detail_reviews')} <span className="text-[#888] font-semibold text-[15px]">({station.reviewCount})</span>
                </h2>
                <StationReviews reviews={station.reviews} />
              </div>
            </div>

            {/* ── Right column — sticky booking sidebar (desktop only) ── */}
            <aside className="hidden lg:block lg:sticky lg:top-[84px] self-start">
              <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-2xl p-6 border border-[#D0D0C0] dark:border-tab-inactive shadow-sm">
                {BookingWidget}
              </div>
            </aside>
          </div>
        </div>

        {/* ── Mobile sticky footer CTA ── */}
        <div className="lg:hidden fixed bottom-16 sm:bottom-0 left-0 right-0 bg-[#F5F5E6]/97 dark:bg-dark-bg/97 backdrop-blur-md border-t border-[#D0D0C0] dark:border-tab-inactive py-3 z-40 transition-colors">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center gap-3">
            <div>
              <div className="text-[20px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">
                {currentForfait ? currentForfait.price : station.priceFrom}
                <span className="text-[14px] font-semibold ml-1 text-[#555] dark:text-[#C0C0B0]">{t('price_unit')}</span>
              </div>
              <div className="text-[12px] text-[#555] dark:text-[#C0C0B0]">
                {currentForfait ? currentForfait.name : t('detail_price_from')}
              </div>
            </div>
            {hasSlots ? (
              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors cursor-pointer btn-shine"
              >
                {t('continue')}
              </button>
            ) : isOpen && currentForfait ? (
              <button
                type="button"
                onClick={handleJoinQueue}
                disabled={joiningQueue}
                className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors cursor-pointer btn-shine disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {joiningQueue ? '...' : t('detail_join_queue')}
              </button>
            ) : (
              <div className="flex-1 py-3 bg-[#E0E0D0] dark:bg-tab-inactive rounded-xl text-[15px] font-bold text-[#444] dark:text-[#C0C0B0] text-center">
                {t('no_slots')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking flow modal */}
      {bookingOpen && currentForfait && (
        <BookingFlow
          station={station}
          category={currentCategory!}
          forfait={currentForfait}
          qrToken={qrToken}
          qrVersion={qrVersion}
          onClose={() => setBookingOpen(false)}
        />
      )}
    </>
  );
}
