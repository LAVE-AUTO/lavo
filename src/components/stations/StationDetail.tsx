'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSearchParams, useRouter } from 'next/navigation';
import { StationReviews } from './StationReviews';
import { BookingFlow } from './booking/BookingFlow';
import { StationServicesSection } from './StationServicesSection';
import { fetchStationById } from '@/services/station-api';
import { useFavorites } from './useFavorites';
import { useUserLocation, haversineKm } from './useUserLocation';
import { LocationPermissionBanner } from './LocationPermissionBanner';
import { PageSpinner } from '@/components/ui/PageSpinner';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/context/auth-context';
import { postWithApi } from '@/services/axios-service';
import type { StationDetailData, StationServicePublic } from '@/types/station';

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
  if (!qrToken || !qrVersion) return { qrToken: null, qrVersion: null };
  return { qrToken, qrVersion };
}

function pickDefaultService(services: StationServicePublic[]): StationServicePublic | null {
  if (services.length === 0) return null;
  return services.find((s) => s.isPopular) ?? services[0];
}

function minPrice(svc: StationServicePublic): number | null {
  const prices = svc.vehicleEntries.map((e) => e.price);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function StationDetail({ id }: StationDetailProps) {
  const t = useTranslations('stations');
  const { isFavorite, toggle } = useFavorites();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { qrToken, qrVersion } = normalizeQrContext(searchParams);
  const { isAuthenticated } = useAuth();
  const locale = useLocale();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [station, setStation] = useState<StationDetailData | null | undefined>(undefined);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  /* Format entry choice persisted per service id - lets users switch services without losing earlier picks. */
  const [formatEntryByService, setFormatEntryByService] = useState<Record<string, string>>({});
  const userLocation = useUserLocation();

  useEffect(() => {
    let cancelled = false;
    fetchStationById(id).then((result) => {
      if (cancelled) return;
      setStation(result);
      const defaultSvc = result ? pickDefaultService(result.stationServices) : null;
      if (defaultSvc) setSelectedServiceId(defaultSvc.id);
    }).catch(() => {
      if (!cancelled) setStation(null);
    });
    return () => { cancelled = true; };
  }, [id]);

  /* Photo carousel auto-rotation - 5 seconds when multiple photos exist. */
  useEffect(() => {
    const photoCount = station?.photos?.length ?? 0;
    if (photoCount < 2) return;
    const ticker = setInterval(() => {
      setPhotoIndex((i) => (i + 1) % photoCount);
    }, 5000);
    return () => clearInterval(ticker);
  }, [station?.photos?.length]);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingRefreshing, setBookingRefreshing] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [navConfirmOpen, setNavConfirmOpen] = useState(false);

  const selectedService = useMemo(
    () => station?.stationServices.find((s) => s.id === selectedServiceId) ?? null,
    [station, selectedServiceId],
  );

  const selectedFormatEntryId = selectedServiceId
    ? formatEntryByService[selectedServiceId] ?? null
    : null;

  const handleSelectService = (id: string) => {
    setSelectedServiceId(id);
  };

  const handleSelectFormatEntry = (entryId: string | null) => {
    if (!selectedServiceId) return;
    setFormatEntryByService((prev) => {
      const next = { ...prev };
      if (entryId == null) delete next[selectedServiceId];
      else next[selectedServiceId] = entryId;
      return next;
    });
  };

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

  const isOpen = station.isOpen !== false;
  const hasServices = station.stationServices.length > 0;

  const selectedFormatEntry = selectedService && selectedFormatEntryId
    ? selectedService.vehicleEntries.find((e) => e.id === selectedFormatEntryId) ?? null
    : null;

  const currentPrice = selectedService
    ? (selectedService.category === 'hand_wash'
        ? (selectedFormatEntry?.price ?? minPrice(selectedService))
        : minPrice(selectedService))
    : station.priceFrom;

  const needsFormatChoice = selectedService?.category === 'hand_wash'
    && selectedService.vehicleEntries.some((e) => e.vehicleFormatId != null)
    && !selectedFormatEntry;

  const distanceLabel = userLocation && station.latitude != null && station.longitude != null
    ? (() => {
        const km = haversineKm(userLocation.latitude, userLocation.longitude, station.latitude, station.longitude);
        return km < 1 ? t('distance_m', { distance: Math.round(km * 1000) }) : t('distance_km', { distance: km.toFixed(1) });
      })()
    : null;

  const handleOpenBooking = async () => {
    if (!isAuthenticated) {
      const callbackUrl = encodeURIComponent(`/${locale ?? 'fr'}/stations/${id}`);
      router.push(`/${locale ?? 'fr'}/login?callbackUrl=${callbackUrl}`);
      return;
    }
    setBookingRefreshing(true);
    try {
      const fresh = await fetchStationById(id);
      if (fresh && mountedRef.current) setStation(fresh);
    } catch {
      // Keep existing data on network error
    } finally {
      if (mountedRef.current) setBookingRefreshing(false);
    }
    if (mountedRef.current) setBookingOpen(true);
  };

  const fallbackMapsUrl =
    station.latitude != null && station.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.name}, ${station.address}, ${station.city}`)}`;

  const handleConfirmEnRoute = async () => {
    setNavigating(true);
    const [ok, data] = await postWithApi<{ data: { mapsUrl: string } }>(`/stations/${id}/join`, {});
    if (!mountedRef.current) return;
    setNavigating(false);
    setNavConfirmOpen(false);
    const result = ok ? (data as { data: { mapsUrl: string } }).data : null;
    const url = result?.mapsUrl ?? fallbackMapsUrl;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* Live queue stats block. */
  const QueueBlock = (
    <div className="rounded-2xl border border-[#D8D8C8] dark:border-tab-inactive bg-[#F0F0E2] dark:bg-dark-bg/40 overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4">
        <span className="w-2 h-2 rounded-full bg-Hurryline-success animate-pulse" />
        <p className="text-[11px] font-black text-[#555] dark:text-[#A0A090] uppercase tracking-[0.15em] flex-1">
          {t('detail_queue')}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 px-5 pt-3 pb-3 text-center">
        <div>
          <p className="text-[22px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">{station.queueCount}</p>
          <p className="text-[10.5px] text-[#666] dark:text-[#B0B0A0] mt-1.5 uppercase tracking-wider font-bold">{t('queue_waiting')}</p>
        </div>
        <div>
          <p className="text-[22px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">
            {station.estimatedWaitMinutes > 0 ? `~${station.estimatedWaitMinutes}` : '--'}
          </p>
          <p className="text-[10.5px] text-[#666] dark:text-[#B0B0A0] mt-1.5 uppercase tracking-wider font-bold">{t('min_attente')}</p>
        </div>
        <div>
          <p className="text-[22px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">
            {distanceLabel ?? '--'}
          </p>
          <p className="text-[10.5px] text-[#666] dark:text-[#B0B0A0] mt-1.5 uppercase tracking-wider font-bold">{t('queue_distance')}</p>
        </div>
      </div>
      {station.queueCount > 0 && distanceLabel && (
        <p className="px-5 pb-4 text-[12.5px] text-[#555] dark:text-[#B0B0A0] leading-snug">
          {t('detail_leave_now')} <strong className="text-gold font-black">{t('detail_perfect_timing')}</strong>
        </p>
      )}
    </div>
  );

  /* Compact summary panel used as the sticky right-column on desktop. */
  const SummaryPanel = (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] text-[#888] dark:text-[#888] uppercase tracking-wider font-bold">{t('detail_price_from')}</p>
          <p className="text-[32px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none mt-1">
            {currentPrice != null ? (
              <>
                {currentPrice.toLocaleString()}
                <span className="text-[16px] font-bold ml-1 text-[#555] dark:text-[#C0C0B0]">{t('price_unit')}</span>
              </>
            ) : '--'}
          </p>
        </div>
        <Badge variant={isOpen ? 'status-open' : 'status-closed'} className="px-3 py-1 text-[12px]">
          <span className={`w-2 h-2 rounded-full mr-1.5 ${isOpen ? 'bg-Hurryline-success animate-pulse' : 'bg-Hurryline-error'}`} />
          {isOpen ? t('status_open') : t('status_closed')}
        </Badge>
      </div>

      {selectedService && (
        <div className="rounded-xl bg-gold/10 border border-gold/30 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gold">{t('detail_selected_service')}</p>
          <p className="text-[14.5px] font-bold text-[#000C1F] dark:text-[#FFF8EC] truncate mt-0.5">{selectedService.name}</p>
        </div>
      )}

      {QueueBlock}

      {(isOpen || hasServices) ? (
        <button
          type="button"
          onClick={handleOpenBooking}
          disabled={bookingRefreshing}
          className="w-full py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg transition-colors cursor-pointer btn-shine disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {bookingRefreshing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('detail_book_service')}
            </span>
          ) : t('detail_book_service')}
        </button>
      ) : (
        <div className="w-full py-3.5 bg-[#E0E0D0] dark:bg-tab-inactive rounded-xl text-[15px] font-bold text-[#444] dark:text-[#C0C0B0] text-center">
          {t('no_slots')}
        </div>
      )}

      {!isOpen && !hasServices && (
        <p className="text-[12.5px] text-[#555] dark:text-[#B0B0A0] leading-relaxed text-center">
          {t('detail_unavailable_notice')}
        </p>
      )}
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-[#F5F5E6] dark:bg-dark-bg transition-colors animate-fade-in">

        {/* ── Hero ── */}
        <div className="relative h-[260px] sm:h-[340px] lg:h-[440px] bg-linear-to-br from-[#D5D5C5] to-[#EDEDED] dark:from-tab-inactive dark:to-dark-bg overflow-hidden">
          {(station.photos?.length ?? 0) > 0 ? (
            station.photos!.map((url, i) => (
              <img
                key={`${i}-${url}`}
                src={url}
                alt={station.name}
                onError={() => setHeroImgFailed(true)}
                className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ${i === photoIndex ? 'opacity-100' : 'opacity-0'}`}
              />
            ))
          ) : station.imageUrl && !heroImgFailed ? (
            <img src={station.imageUrl} alt={station.name} onError={() => setHeroImgFailed(true)} className="w-full h-full object-cover object-center" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#999] dark:text-[#3A4A36] text-[14px] font-semibold">
              Photo
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

          {(station.photos?.length ?? 0) > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
              {station.photos!.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPhotoIndex(i)}
                  aria-label={t('detail_photo_dot', { index: i + 1 })}
                  className={`h-1.5 rounded-full transition-all ${i === photoIndex ? 'bg-white w-5' : 'bg-white/60 hover:bg-white/80 w-1.5'}`}
                />
              ))}
            </div>
          )}

          <Link
            href="/stations"
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition-colors"
            aria-label={t('back_to_list')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>

          <button
            type="button"
            onClick={() => toggle(id)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
            aria-label={isFavorite(id) ? t('detail_remove_favorite') : t('detail_add_favorite')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isFavorite(id) ? '#C49A1E' : 'none'} stroke={isFavorite(id) ? '#C49A1E' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>

          {/* Station identity overlay - bottom-left of hero */}
          <div className="absolute left-4 right-4 sm:left-6 sm:right-6 bottom-4 sm:bottom-6 text-white">
            <h1 className="text-[22px] sm:text-[28px] lg:text-[34px] font-black leading-tight drop-shadow-md">
              {station.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] sm:text-[13px]">
              <span className="inline-flex items-center gap-1 font-bold">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFD36B" stroke="#FFD36B" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>{station.rating.toFixed(1)}</span>
                <span className="opacity-80 font-semibold">({station.reviewCount})</span>
              </span>
              {distanceLabel && (
                <>
                  <span className="w-px h-3.5 bg-white/40" aria-hidden="true" />
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {distanceLabel}
                  </span>
                </>
              )}
              {station.openingHours && (
                <>
                  <span className="w-px h-3.5 bg-white/40" aria-hidden="true" />
                  <span className="font-semibold">{station.openingHours}</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${isOpen ? 'bg-Hurryline-success/20 text-white border border-Hurryline-success/40' : 'bg-Hurryline-error/20 text-white border border-Hurryline-error/40'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-Hurryline-success animate-pulse' : 'bg-Hurryline-error'}`} />
                {isOpen ? t('status_open') : t('status_closed')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider bg-gold/25 text-white border border-gold/50">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('detail_verified_label')}
              </span>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-16 py-7 pb-36 sm:pb-28 lg:pb-14">
          <LocationPermissionBanner />
          <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-12 lg:items-start">

            {/* ── Left column ── */}
            <div className="space-y-7">

              {/* Mobile summary panel */}
              <div className="lg:hidden bg-[#E8E8D8] dark:bg-dark-card rounded-2xl p-5 border border-[#D0D0C0] dark:border-tab-inactive">
                {SummaryPanel}
              </div>

              {/* Services */}
              <StationServicesSection
                services={station.stationServices}
                selectedServiceId={selectedServiceId}
                selectedFormatEntryId={selectedFormatEntryId}
                onSelectService={handleSelectService}
                onSelectFormatEntry={handleSelectFormatEntry}
                onBook={handleOpenBooking}
                bookingLoading={bookingRefreshing}
                disabledBook={(!isOpen && !hasServices) || needsFormatChoice}
              />

              {/* Description */}
              {station.description && (
                <div>
                  <h2 className="text-[17px] font-black text-[#000C1F] dark:text-[#FFF8EC] mb-2">{t('detail_description')}</h2>
                  <p className="text-[14.5px] text-[#555] dark:text-[#C0C0B0] leading-[1.75]">{station.description}</p>
                </div>
              )}

              {/* Location */}
              <button
                type="button"
                onClick={() => setNavConfirmOpen(true)}
                disabled={navigating}
                className="flex w-full items-center gap-4 bg-[#E8E8D8] dark:bg-dark-card rounded-2xl px-5 py-4 transition-colors hover:border-gold/40 border border-[#D0D0C0] dark:border-tab-inactive group/loc text-left cursor-pointer disabled:opacity-60"
              >
                <div className="w-11 h-11 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#000C1F] dark:text-[#FFF8EC] truncate">{station.address}</p>
                  <p className="text-[13px] text-[#555] dark:text-[#C0C0B0]">{station.city}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 group-hover/loc:translate-x-0.5 transition-transform">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {/* Reviews */}
              <div>
                <h2 className="text-[17px] font-black text-[#000C1F] dark:text-[#FFF8EC] mb-4">
                  {t('detail_reviews')} <span className="text-[#888] font-semibold text-[15px]">({station.reviewCount})</span>
                </h2>
                <StationReviews reviews={station.reviews} />
              </div>
            </div>

            {/* ── Desktop sticky summary ── */}
            <aside className="hidden lg:block lg:sticky lg:top-[84px] self-start">
              <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-2xl p-6 border border-[#D0D0C0] dark:border-tab-inactive shadow-sm">
                {SummaryPanel}
              </div>
            </aside>
          </div>
        </div>

        {/* ── Mobile sticky footer CTA ── */}
        <div className="lg:hidden fixed bottom-16 sm:bottom-0 left-0 right-0 bg-[#F5F5E6]/97 dark:bg-dark-bg/97 backdrop-blur-md border-t border-[#D0D0C0] dark:border-tab-inactive py-3 z-40 transition-colors">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[20px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">
                {currentPrice != null ? (
                  <>{currentPrice.toLocaleString()}<span className="text-[14px] font-semibold text-[#555] dark:text-[#C0C0B0] ml-1">{t('price_unit')}</span></>
                ) : '--'}
              </p>
              <p className="text-[11px] text-[#555] dark:text-[#C0C0B0] mt-1 truncate">
                {selectedService ? selectedService.name : t('detail_price_from')}
              </p>
            </div>
            {(isOpen || hasServices) ? (
              <button
                type="button"
                onClick={handleOpenBooking}
                disabled={bookingRefreshing}
                className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors cursor-pointer btn-shine disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {bookingRefreshing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('detail_book_service')}
                  </span>
                ) : t('detail_book_service')}
              </button>
            ) : (
              <div className="flex-1 py-3 bg-[#E0E0D0] dark:bg-tab-inactive rounded-xl text-[15px] font-bold text-[#444] dark:text-[#C0C0B0] text-center">
                {t('no_slots')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking flow modal - pre-selected service from the detail screen */}
      {bookingOpen && (
        <BookingFlow
          station={station}
          qrToken={qrToken}
          qrVersion={qrVersion}
          initialServiceId={selectedServiceId}
          initialFormatEntryId={selectedFormatEntryId}
          onClose={() => setBookingOpen(false)}
        />
      )}

      <ConfirmDialog
        open={navConfirmOpen}
        title={t('detail_navigate_title')}
        message={t('detail_navigate_message')}
        confirmLabel={t('detail_navigate_confirm')}
        cancelLabel={t('detail_navigate_cancel')}
        loading={navigating}
        onConfirm={handleConfirmEnRoute}
        onCancel={() => setNavConfirmOpen(false)}
      />
    </>
  );
}
