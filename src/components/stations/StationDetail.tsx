'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { useToast } from '@/context/toast-context';
import { Spinner } from '@/components/ui/Spinner';
import { StarRating } from '@/components/ratings/StarRating';
import { StationReviews } from './StationReviews';
import type { StationDetailData } from '@/types/station';
import type { ApiSuccessBody } from '@/types';

interface StationDetailProps {
  id: string;
}

/**
 * Client-side station detail view.
 * Fetches GET /stations/:id and renders hero, info, services, queue and reviews.
 */
export function StationDetail({ id }: StationDetailProps) {
  const t = useTranslations('stations');
  const { success, error } = useToast();

  const [station, setStation] = useState<StationDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      setHasError(false);
      const [ok, data] = await getFromApi<ApiSuccessBody<StationDetailData>>(`/stations/${id}`);
      if (cancelled) return;
      setLoading(false);
      if (ok) {
        setStation((data as ApiSuccessBody<StationDetailData>).data);
      } else {
        setHasError(true);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [id]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Spinner size="lg" />
        <p className="text-[14px] text-lavo-muted">{t('loading')}</p>
      </div>
    );
  }

  if (hasError || !station) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <p className="text-[15px] font-semibold text-[#1A1A1A] dark:text-white">{t('error_load')}</p>
        <Link href="/stations" className="text-[14px] font-semibold text-gold hover:text-gold-hover transition-colors">
          {t('back_to_list')}
        </Link>
      </div>
    );
  }

  const hasSlots = station.availableSlots > 0;

  return (
    <div className="animate-fade-in">
      <StationHero station={station} />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <StationMeta station={station} />

        <PriceBox station={station} t={t} />

        {station.description && (
          <Section title={t('detail_description')}>
            <p className="text-[14px] text-lavo-muted leading-relaxed">{station.description}</p>
          </Section>
        )}

        {station.services.length > 0 && (
          <Section title={t('detail_services')}>
            <ServicesList services={station.services} />
          </Section>
        )}

        <Section title={t('detail_queue')}>
          <QueueBanner station={station} t={t} />
        </Section>

        <Section title={t('detail_reviews')}>
          <StationReviews reviews={station.reviews} />
        </Section>

        {/* Join CTA */}
        {hasSlots ? (
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="btn-shine w-full py-4 bg-gold hover:bg-gold-hover active:scale-[0.98] disabled:opacity-70 rounded-[10px] text-[16px] font-bold text-[#1A2116] tracking-wide transition-all duration-150 flex items-center justify-center gap-2"
          >
            {joining ? <><Spinner size="sm" />{t('loading')}</> : t('detail_join')}
          </button>
        ) : (
          <div className="w-full py-4 bg-[#F0F0E8] dark:bg-dark-card rounded-[10px] text-[14px] font-semibold text-lavo-muted text-center border border-[#E0E0D0] dark:border-[#3A4A36]">
            {t('no_slots')}
          </div>
        )}

        <div className="text-center pb-4">
          <Link href="/stations" className="text-[13px] font-semibold text-gold hover:text-gold-hover transition-colors">
            {t('back_to_list')}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Internal sub-components                                              */
/* ------------------------------------------------------------------ */

function StationHero({ station }: { station: StationDetailData }) {
  return (
    <div className="relative h-[200px] sm:h-[260px] bg-gradient-to-br from-[#2C3828] to-[#1A2116] flex items-center justify-center overflow-hidden">
      {station.imageUrl ? (
        <img src={station.imageUrl} alt={station.name} className="w-full h-full object-cover" />
      ) : (
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#3A4A36" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 17l2-7h14l2 7" />
          <path d="M5 17v2h2v-2M17 17v2h2v-2" />
          <path d="M8 10V7a1 1 0 011-1h6a1 1 0 011 1v3" />
          <circle cx="7.5" cy="17" r="1.5" fill="#3A4A36" />
          <circle cx="16.5" cy="17" r="1.5" fill="#3A4A36" />
        </svg>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}

function StationMeta({ station }: { station: StationDetailData }) {
  const t = useTranslations('stations');
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="text-[22px] font-bold text-[#1A1A1A] dark:text-white leading-tight">
          {station.name}
        </h1>
        {station.verified && (
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-lavo-success/10 border border-lavo-success/30 text-lavo-success text-[11px] font-bold">
            {t('detail_verified')}
          </span>
        )}
      </div>
      <p className="text-[13px] text-lavo-muted mb-3">{station.address}, {station.city}</p>
      <div className="flex items-center gap-2">
        <StarRating value={station.rating} size="md" />
        <span className="text-[13px] font-semibold text-[#1A1A1A] dark:text-white">{station.rating.toFixed(1)}</span>
        <span className="text-[13px] text-lavo-muted">{t('reviews_count', { count: station.reviewCount })}</span>
      </div>
    </div>
  );
}

function PriceBox({ station, t }: { station: StationDetailData; t: ReturnType<typeof useTranslations<'stations'>> }) {
  return (
    <div className="bg-[#F5F5EE] dark:bg-dark-card rounded-xl p-4 border border-[#EBEBDF] dark:border-[#2C3828]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] text-lavo-muted font-semibold uppercase tracking-wide">{t('detail_price_from')}</span>
        <span className="text-[24px] font-black text-gold">{station.priceFrom.toLocaleString()} {t('price_unit')}</span>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-lavo-muted">
        <span className="w-2 h-2 rounded-full bg-lavo-success shrink-0" />
        <span>{t('available_slots', { count: station.availableSlots })}</span>
        {station.openingHours && (
          <>
            <span className="mx-1">·</span>
            <span>{station.openingHours}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ServicesList({ services }: { services: string[] }) {
  return (
    <ul className="space-y-2">
      {services.map((service) => (
        <li key={service} className="flex items-center gap-2 text-[13px] text-[#1A1A1A] dark:text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {service}
        </li>
      ))}
    </ul>
  );
}

function QueueBanner({ station, t }: { station: StationDetailData; t: ReturnType<typeof useTranslations<'stations'>> }) {
  return (
    <div className="bg-[#F5F5EE] dark:bg-dark-card rounded-xl p-4 border border-[#EBEBDF] dark:border-[#2C3828]">
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatCell value={station.queueCount} label={t('queue_waiting')} />
        <StatCell value={station.availableSlots} label={t('queue_available')} highlight />
        <StatCell value={`${station.estimatedWaitMinutes} min`} label={t('queue_in_progress')} />
      </div>
    </div>
  );
}

function StatCell({ value, label, highlight }: { value: string | number; label: string; highlight?: boolean }) {
  return (
    <div>
      <p className={`text-[20px] font-black ${highlight ? 'text-gold' : 'text-[#1A1A1A] dark:text-white'}`}>
        {value}
      </p>
      <p className="text-[10px] text-lavo-muted font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-bold text-[#1A1A1A] dark:text-white mb-3 uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}
