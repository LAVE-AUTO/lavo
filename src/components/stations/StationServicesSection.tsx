'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { StationServicePublic } from '@/types/station';

interface StationServicesSectionProps {
  services: StationServicePublic[];
  selectedServiceId: string | null;
  selectedFormatEntryId: string | null;
  onSelectService: (id: string) => void;
  onSelectFormatEntry: (entryId: string | null) => void;
  onBook: () => void;
  bookingLoading?: boolean;
  disabledBook?: boolean;
}

const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  hand_wash:      { fr: 'Lavage à la main',  en: 'Hand wash' },
  automatic_wash: { fr: 'Lavage automatique', en: 'Auto wash' },
  self_service:   { fr: 'Self-service',      en: 'Self-service' },
  exterior_wash:  { fr: 'Lavage extérieur',  en: 'Exterior wash' },
  detailing:      { fr: 'Détailing',         en: 'Detailing' },
};

function categoryLabel(cat: string, locale: string): string {
  const entry = CATEGORY_LABELS[cat];
  if (!entry) return cat;
  return locale === 'en' ? entry.en : entry.fr;
}

function pickFeatured(services: StationServicePublic[]): StationServicePublic | null {
  if (services.length === 0) return null;
  const popular = services.find((s) => s.isPopular);
  if (popular) return popular;
  return services[0];
}

function minPrice(svc: StationServicePublic): number | null {
  const prices = svc.vehicleEntries.map((e) => e.price);
  return prices.length > 0 ? Math.min(...prices) : null;
}

function minDuration(svc: StationServicePublic): number | null {
  const durations = svc.vehicleEntries.map((e) => e.duration);
  return durations.length > 0 ? Math.min(...durations) : null;
}

/**
 * Rich services section for the station detail screen.
 * Shows one "featured" service in a hero card and the remaining services
 * as compact action cards. Selecting any service updates the highlight and
 * also surfaces it through `onSelectService` so the parent can sync price
 * and pre-select it in the booking flow.
 */
export function StationServicesSection({
  services,
  selectedServiceId,
  selectedFormatEntryId,
  onSelectService,
  onSelectFormatEntry,
  onBook,
  bookingLoading = false,
  disabledBook = false,
}: StationServicesSectionProps) {
  const t = useTranslations('stations');
  const tb = useTranslations('booking');

  const featuredDefault = useMemo(() => pickFeatured(services), [services]);
  const [featuredOverride, setFeaturedOverride] = useState<string | null>(null);

  const featured = useMemo(() => {
    if (featuredOverride) return services.find((s) => s.id === featuredOverride) ?? featuredDefault;
    if (selectedServiceId) return services.find((s) => s.id === selectedServiceId) ?? featuredDefault;
    return featuredDefault;
  }, [services, featuredOverride, selectedServiceId, featuredDefault]);

  const others = useMemo(
    () => services.filter((s) => s.id !== featured?.id),
    [services, featured],
  );

  /* Locale-aware category label without pulling another hook. */
  const locale = (typeof document !== 'undefined' ? document.documentElement.lang : 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';

  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-[#D0D0C0] dark:border-tab-inactive bg-[#F0F0E2] dark:bg-dark-bg/40 px-5 py-8 text-center text-[14px] text-[#555] dark:text-[#B0B0A0]">
        {tb('service_no_services')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-[17px] font-black text-[#000C1F] dark:text-[#FFF8EC]">{t('detail_services')}</h2>

      {featured && (
        <FeaturedServiceCard
          service={featured}
          selected={selectedServiceId === featured.id}
          locale={locale}
          selectedFormatEntryId={selectedFormatEntryId}
          onSelectFormatEntry={onSelectFormatEntry}
          onBook={onBook}
          bookingLoading={bookingLoading}
          disabledBook={disabledBook}
        />
      )}

      {others.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[11px] font-black text-[#555] dark:text-[#A0A090] uppercase tracking-[0.15em]">
            {t('services_other')}
          </p>
          {others.map((svc) => (
            <OtherServiceCard
              key={svc.id}
              service={svc}
              locale={locale}
              onSelect={() => {
                setFeaturedOverride(svc.id);
                onSelectService(svc.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Featured service card - hero treatment, includes "Choisir" CTA      */
/* ------------------------------------------------------------------ */

interface FeaturedServiceCardProps {
  service: StationServicePublic;
  selected: boolean;
  locale: 'fr' | 'en';
  selectedFormatEntryId: string | null;
  onSelectFormatEntry: (entryId: string | null) => void;
  onBook: () => void;
  bookingLoading: boolean;
  disabledBook: boolean;
}

function FeaturedServiceCard({
  service,
  selected,
  locale,
  selectedFormatEntryId,
  onSelectFormatEntry,
  onBook,
  bookingLoading,
  disabledBook,
}: FeaturedServiceCardProps) {
  const t = useTranslations('stations');
  const isHandWash = service.category === 'hand_wash';
  const formatEntries = isHandWash
    ? service.vehicleEntries.filter((e) => e.vehicleFormatId != null)
    : [];
  const selectedEntry = formatEntries.find((e) => e.id === selectedFormatEntryId) ?? null;

  /* For hand_wash, price/duration reflect the picked format. Otherwise show the cheapest entry as a hint. */
  const price = isHandWash
    ? (selectedEntry?.price ?? null)
    : minPrice(service);
  const duration = isHandWash
    ? (selectedEntry?.duration ?? null)
    : minDuration(service);
  const needsFormat = isHandWash && formatEntries.length > 0 && !selectedEntry;

  return (
    <div className={[
      'rounded-2xl border-[1.5px] overflow-hidden transition-colors',
      selected
        ? 'border-gold bg-gold/5 dark:bg-gold/10'
        : 'border-[#D0D0C0] dark:border-tab-inactive bg-[#F0F0E2] dark:bg-dark-bg/40',
    ].join(' ')}>
      <div className="px-5 pt-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[18px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-tight">{service.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {service.isPopular && (
              <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30">
                {t('badge_popular')}
              </span>
            )}
            {duration != null && (
              <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-[#E0E0D0] dark:bg-tab-inactive border border-[#D0D0C0] dark:border-tab-inactive text-[#555] dark:text-[#B0B0A0]">
                {t('badge_duration', { min: duration })}
              </span>
            )}
            <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-[#E0E0D0] dark:bg-tab-inactive border border-[#D0D0C0] dark:border-tab-inactive text-[#555] dark:text-[#B0B0A0]">
              {categoryLabel(service.category, locale)}
            </span>
          </div>
        </div>
        {price != null && (
          <div className="text-right shrink-0">
            <span className="text-[12px] font-bold text-gold align-top mr-0.5">$</span>
            <span className="text-[28px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">{price.toLocaleString()}</span>
            <p className="text-[10px] text-[#888] dark:text-[#888] mt-1 uppercase tracking-wider">{t('detail_price_from')}</p>
          </div>
        )}
      </div>

      {service.description && (
        <p className="px-5 mt-3 text-[13.5px] text-[#555] dark:text-[#B0B0A0] leading-relaxed">
          {service.description}
        </p>
      )}

      {service.extras.length > 0 && (
        <div className="px-5 mt-4">
          <p className="text-[11px] font-black text-[#555] dark:text-[#A0A090] uppercase tracking-[0.15em] mb-2.5">
            {t('services_extras_label')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {service.extras.slice(0, 4).map((extra) => (
              <div
                key={extra.id}
                className="flex items-center gap-2 rounded-xl border border-[#D8D8C8] dark:border-tab-inactive bg-white/60 dark:bg-dark-bg/50 px-3 py-2 text-[12.5px] font-semibold text-[#222] dark:text-[#D0D0C0]"
              >
                <span className="w-5 h-5 rounded-md bg-Hurryline-success flex items-center justify-center shrink-0">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="truncate">{extra.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isHandWash && formatEntries.length > 0 && (
        <div className="px-5 mt-4">
          <p className="text-[11px] font-black text-[#555] dark:text-[#A0A090] uppercase tracking-[0.15em] mb-2.5">
            {t('services_format_label')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {formatEntries.map((entry) => {
              const isSelected = selectedFormatEntryId === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectFormatEntry(entry.id)}
                  aria-pressed={isSelected}
                  className={[
                    'text-left rounded-xl border-[1.5px] p-3 transition-colors cursor-pointer',
                    isSelected
                      ? 'border-gold bg-gold/10 dark:bg-gold/15'
                      : 'border-[#D8D8C8] dark:border-tab-inactive bg-white/60 dark:bg-dark-bg/50 hover:border-gold/40',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-tight truncate">
                      {entry.formatLabel}
                    </span>
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'}`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-dark-bg" />}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-[14px] font-black text-gold leading-none">
                      ${entry.price.toLocaleString()}
                    </span>
                    <span className="text-[10.5px] font-bold text-[#888] dark:text-[#888]">
                      · {entry.duration} min
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-5 py-4 mt-4 border-t border-[#D8D8C8] dark:border-tab-inactive bg-[#E8E8D8]/40 dark:bg-dark-bg/30">
        <button
          type="button"
          onClick={onBook}
          disabled={bookingLoading || disabledBook || needsFormat}
          title={needsFormat ? t('services_pick_format_hint') : undefined}
          className="w-full py-2.5 bg-gold hover:bg-gold-hover rounded-xl text-[13.5px] font-black text-dark-bg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed btn-shine"
        >
          {bookingLoading
            ? t('services_loading')
            : needsFormat
              ? t('services_pick_format')
              : t('services_book_now')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Other service card - compact list item                              */
/* ------------------------------------------------------------------ */

interface OtherServiceCardProps {
  service: StationServicePublic;
  locale: 'fr' | 'en';
  onSelect: () => void;
}

function OtherServiceCard({ service, locale, onSelect }: OtherServiceCardProps) {
  const t = useTranslations('stations');
  const price = minPrice(service);
  const duration = minDuration(service);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-[#D0D0C0] dark:border-tab-inactive bg-[#F0F0E2] dark:bg-dark-bg/40 hover:border-gold/40 hover:bg-gold/5 dark:hover:bg-gold/10 transition-colors cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold text-[#000C1F] dark:text-[#FFF8EC] truncate">{service.name}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {duration != null && (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#777] dark:text-[#888]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {t('badge_duration', { min: duration })}
            </span>
          )}
          <span className="text-[10.5px] font-bold tracking-wide text-[#777] dark:text-[#888]">
            · {categoryLabel(service.category, locale)}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {price != null && (
          <span className="text-[20px] font-black text-gold leading-none">
            ${price.toLocaleString()}
          </span>
        )}
      </div>
    </button>
  );
}
