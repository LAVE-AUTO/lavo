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
import { useAuth } from '@/context/auth-context';
import { postWithApi } from '@/services/axios-service';
import type { StationDetailData } from '@/types/station';

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

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

  useEffect(() => {
    let cancelled = false;
    fetchStationById(id).then((result) => {
      if (!cancelled) setStation(result);
    }).catch(() => {
      if (!cancelled) setStation(null);
    });
    return () => { cancelled = true; };
  }, [id]);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);

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

  // Calculate minimum service duration
  const minServiceDuration = station.stationServices.length > 0
    ? Math.min(...station.stationServices.flatMap(svc => svc.vehicleEntries.map(entry => entry.duration)))
    : 30; // fallback

  // Calculate distance from user location (mock for now - would use geolocation API)
  const userLat = 45.5017; // Montreal coordinates as example
  const userLng = -73.5673;
  const stationLat = station.latitude || 0;
  const stationLng = station.longitude || 0;
  const distance = calculateDistance(userLat, userLng, stationLat, stationLng);

  const handleOpenBooking = () => {
    if (!isAuthenticated) {
      const callbackUrl = encodeURIComponent(`/stations/${id}`);
      router.push(`/${locale ?? 'fr'}/login?callbackUrl=${callbackUrl}`);
      return;
    }
    setBookingOpen(true);
  };

  const fallbackMapsUrl =
    station.latitude != null && station.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.name}, ${station.address}, ${station.city}`)}`;

  const handleEnRoute = async () => {
    setNavigating(true);
    const [ok, data] = await postWithApi<{ data: { mapsUrl: string } }>(`/stations/${id}/join`, {});
    if (!mountedRef.current) return;
    setNavigating(false);
    const result = ok ? (data as { data: { mapsUrl: string } }).data : null;
    const url = result?.mapsUrl ?? fallbackMapsUrl;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* ── Booking widget ── */
  const BookingWidget = (
    <div className="space-y-5">
      {/* Price + status row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[24px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">
            {station.priceFrom != null ? (
              <>
                {station.priceFrom.toLocaleString()}
                <span className="text-[14px] font-semibold ml-1 text-[#555] dark:text-[#C0C0B0]">{t('price_unit')}</span>
              </>
            ) : (
              <span className="text-[18px] font-bold text-[#555] dark:text-[#C0C0B0]">--</span>
            )}
          </div>
          <div className="text-[13px] text-[#555] dark:text-[#C0C0B0] mt-0.5">{t('detail_price_from')}</div>
        </div>
        <Badge variant={isOpen ? 'status-open' : 'status-closed'} className="px-3 py-1 text-[13px]">
          <span className={`w-2 h-2 rounded-full mr-1.5 ${isOpen ? 'bg-lavo-success animate-pulse' : 'bg-lavo-error'}`} />
          {isOpen ? t('status_open') : t('status_closed')}
        </Badge>
      </div>

      {/* Queue stats */}
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
            <div className={`text-[20px] font-black leading-none ${minServiceDuration > 60 ? 'text-lavo-error' : 'text-[#000C1F] dark:text-[#FFF8EC]'}`}>
              {minServiceDuration}
            </div>
            <div className="text-[11px] text-[#555] dark:text-[#C0C0B0] mt-1">{t('min_attente')}</div>
          </div>
          <div>
            <div className="text-[20px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">{distance.toFixed(1)} km</div>
            <div className="text-[11px] text-[#555] dark:text-[#C0C0B0] mt-1">{t('detail_distance')}</div>
          </div>
        </div>
      </div>

      {/* Unavailable notice */}
      {!isOpen && !hasServices && (
        <div className="rounded-xl border border-[#D0D0C0] dark:border-tab-inactive bg-[#F0F0E2] dark:bg-dark-bg/50 px-4 py-4 text-[14px] text-[#555] dark:text-[#B0B0A0] text-center leading-relaxed">
          {t('detail_unavailable_notice')}
        </div>
      )}

      {/* CTA */}
      {(isOpen || hasServices) ? (
        <button
          type="button"
          onClick={handleOpenBooking}
          className="w-full py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors cursor-pointer btn-shine"
        >
          {t('detail_book_service')}
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

        {/* ── Hero ── */}
        <div className="relative h-[240px] sm:h-[320px] lg:h-[440px] bg-linear-to-br from-[#D5D5C5] to-[#EDEDED] dark:from-tab-inactive dark:to-dark-bg overflow-hidden">
          {station.imageUrl ? (
            <img src={station.imageUrl} alt={station.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#999] dark:text-[#3A4A36] text-[14px] font-semibold">
              Photo
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

          <Link
            href="/stations"
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label={t('back_to_list')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>

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

          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-5 pt-12">
            <div className="max-w-[1440px] mx-auto">
              <h1 className="text-[26px] sm:text-[32px] lg:text-[38px] font-black text-white leading-tight drop-shadow mb-2">
                {station.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex items-center gap-2 text-white text-[16px]">
                  <span className="text-gold text-[18px]">&#9733;</span>
                  <span className="font-bold">{station.rating.toFixed(1)}</span>
                  <span className="opacity-90">{t('reviews_count', { count: station.reviewCount })}</span>
                </span>
                {station.verified && (
                  <Badge variant="verified" className="backdrop-blur-sm border border-gold/40 px-3 py-1 text-[13px]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><polyline points="20 6 9 17 4 12" /></svg>
                    {t('detail_verified')}
                  </Badge>
                )}
                {station.openingHours && (
                  <span className="text-white/90 text-[15px] font-medium">&#183; {station.openingHours}</span>
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

              {/* Booking widget - mobile/tablet only */}
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
              <button
                type="button"
                onClick={handleEnRoute}
                disabled={navigating}
                className="flex w-full items-center gap-4 bg-[#E8E8D8] dark:bg-dark-card rounded-xl px-5 py-4 transition-colors hover:border-gold/40 border border-[#D0D0C0] dark:border-tab-inactive group/loc text-left cursor-pointer disabled:opacity-60"
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
              </button>

              {/* Reviews */}
              <div>
                <h2 className="text-[17px] font-black text-[#000C1F] dark:text-[#FFF8EC] mb-4">
                  {t('detail_reviews')} <span className="text-[#888] font-semibold text-[15px]">({station.reviewCount})</span>
                </h2>
                <StationReviews reviews={station.reviews} reviewCount={station.reviewCount} />
              </div>
            </div>

            {/* ── Right column - sticky booking sidebar (desktop) ── */}
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
                {station.priceFrom != null ? (
                  <>{station.priceFrom.toLocaleString()} <span className="text-[14px] font-semibold text-[#555] dark:text-[#C0C0B0]">{t('price_unit')}</span></>
                ) : '--'}
              </div>
              <div className="text-[12px] text-[#555] dark:text-[#C0C0B0]">{t('detail_price_from')}</div>
            </div>
            {(isOpen || hasServices) ? (
              <button
                type="button"
                onClick={handleOpenBooking}
                className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors cursor-pointer btn-shine"
              >
                {t('detail_book_service')}
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
      {bookingOpen && (
        <BookingFlow
          station={station}
          qrToken={qrToken}
          qrVersion={qrVersion}
          onClose={() => setBookingOpen(false)}
        />
      )}
    </>
  );
}
