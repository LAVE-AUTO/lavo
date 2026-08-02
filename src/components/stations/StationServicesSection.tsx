'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatMoneyPrefix } from '@/helpers/money';
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

/* Aligned on the DB enum (station_services.category): three values only. */
const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  hand_wash:    { fr: 'Lavage à la main',  en: 'Hand wash' },
  automatic:    { fr: 'Lavage automatique', en: 'Automatic wash' },
  self_service: { fr: 'Self-service',      en: 'Self-service' },
};

function categoryLabel(cat: string, locale: 'fr' | 'en'): string {
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
 * Services section grouped by category.
 * Renders a tab strip when the station offers more than one category, then a
 * featured card for the selected service plus the rest of that category as
 * compact items. With a single category the tab strip is hidden.
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
  const rawLocale = useLocale();
  const locale: 'fr' | 'en' = rawLocale === 'en' ? 'en' : 'fr';

  const categories = useMemo(() => {
    const order: string[] = [];
    const grouped = new Map<string, StationServicePublic[]>();
    for (const svc of services) {
      if (!grouped.has(svc.category)) {
        order.push(svc.category);
        grouped.set(svc.category, []);
      }
      grouped.get(svc.category)!.push(svc);
    }
    return order.map((cat) => ({ category: cat, services: grouped.get(cat)! }));
  }, [services]);

  const featuredDefault = useMemo(() => pickFeatured(services), [services]);

  const [activeCategory, setActiveCategory] = useState<string | null>(
    () => featuredDefault?.category ?? categories[0]?.category ?? null,
  );

  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0].category);
      return;
    }
    if (activeCategory && !categories.find((c) => c.category === activeCategory)) {
      setActiveCategory(categories[0]?.category ?? null);
    }
  }, [categories, activeCategory]);

  /* Whenever the user switches the selected service, jump to the matching tab
   * so the highlight stays in sync with the right-column summary. */
  useEffect(() => {
    if (!selectedServiceId) return;
    const svc = services.find((s) => s.id === selectedServiceId);
    if (svc && svc.category !== activeCategory) setActiveCategory(svc.category);
  }, [selectedServiceId, services, activeCategory]);

  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface/60 px-5 py-8 text-center text-[14px] text-foreground/70">
        {tb('service_no_services')}
      </div>
    );
  }

  const visibleServices = activeCategory
    ? categories.find((c) => c.category === activeCategory)?.services ?? []
    : services;

  const featured = (() => {
    if (selectedServiceId) {
      const match = visibleServices.find((s) => s.id === selectedServiceId);
      if (match) return match;
    }
    const popular = visibleServices.find((s) => s.isPopular);
    return popular ?? visibleServices[0] ?? null;
  })();

  const others = featured
    ? visibleServices.filter((s) => s.id !== featured.id)
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[17px] font-black text-foreground">{t('detail_services')}</h2>
        <p className="text-[12.5px] text-foreground/65 mt-1">
          {t('detail_services_subtitle')}
        </p>
      </div>

      {categories.length > 1 && (
        <div
          role="radiogroup"
          aria-label={t('detail_services')}
          className="flex flex-wrap gap-2"
        >
          {categories.map((cat) => {
            const isActive = cat.category === activeCategory;
            return (
              <button
                key={cat.category}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => {
                  setActiveCategory(cat.category);
                  const next = cat.services.find((s) => s.isPopular) ?? cat.services[0];
                  if (next) onSelectService(next.id);
                }}
                className={[
                  'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-bold transition-colors cursor-pointer border',
                  isActive
                    ? 'bg-gold/10 text-foreground border-gold'
                    : 'bg-surface/60 text-foreground/70 border-border hover:border-gold/40 hover:text-gold',
                ].join(' ')}
              >
                {/* Radio indicator: filled when this category is selected, empty otherwise */}
                <span
                  aria-hidden="true"
                  className={[
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isActive ? 'border-gold' : 'border-[#BBB] dark:border-[#555]',
                  ].join(' ')}
                >
                  {isActive && <span className="h-2 w-2 rounded-full bg-gold" />}
                </span>
                {categoryLabel(cat.category, locale)}
                <span className="opacity-70 font-semibold">({cat.services.length})</span>
              </button>
            );
          })}
        </div>
      )}

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
          <p className="text-[11px] font-black text-foreground/70 dark:text-[#B0BFB1] uppercase tracking-[0.15em]">
            {t('services_other')}
          </p>
          {others.map((svc) => (
            <OtherServiceCard
              key={svc.id}
              service={svc}
              locale={locale}
              onSelect={() => onSelectService(svc.id)}
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
        : 'border-border bg-surface/60',
    ].join(' ')}>
      <div className="px-5 pt-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[18px] font-black text-foreground leading-tight">{service.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {service.isPopular && (
              <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30">
                {t('badge_popular')}
              </span>
            )}
            {duration != null && (
              <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-surface dark:bg-tab-inactive border border-border text-foreground/70">
                {t('badge_duration', { min: duration })}
              </span>
            )}
            <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-surface dark:bg-tab-inactive border border-border text-foreground/70">
              {categoryLabel(service.category, locale)}
            </span>
          </div>
        </div>
        {price != null && (
          <div className="text-right shrink-0">
            <span className="text-[28px] font-black text-foreground leading-none">{formatMoneyPrefix(price)}</span>
            <p className="text-[10px] text-foreground/55 mt-1 uppercase tracking-wider">{t('detail_price_from')}</p>
          </div>
        )}
      </div>

      {service.description && (
        <div className="px-5 mt-4">
          <p className="text-[11px] font-black text-foreground/70 dark:text-[#B0BFB1] uppercase tracking-[0.15em] mb-1.5">
            {t('detail_description')}
          </p>
          <p className="text-[13.5px] text-foreground/70 leading-relaxed">
            {service.description}
          </p>
        </div>
      )}

      {isHandWash && formatEntries.length > 0 && (
        <div className="px-5 mt-4">
          <p className="text-[11px] font-black text-foreground/70 dark:text-[#B0BFB1] uppercase tracking-[0.15em] mb-2.5">
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
                      : 'border-border bg-white/60 dark:bg-background/50 hover:border-gold/40',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-black text-foreground leading-tight truncate">
                      {entry.formatLabel}
                    </span>
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'}`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-dark-bg" />}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-[14px] font-black text-gold leading-none">
                      {formatMoneyPrefix(entry.price)}
                    </span>
                    <span className="text-[10.5px] font-bold text-foreground/55">
                      · {entry.duration} min
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-5 py-4 mt-4 border-t border-border bg-surface/40 dark:bg-background/30">
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
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface/60 hover:border-gold/40 hover:bg-gold/5 dark:hover:bg-gold/10 transition-colors cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold text-foreground truncate">{service.name}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {duration != null && (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#777] dark:text-foreground/55">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {t('badge_duration', { min: duration })}
            </span>
          )}
          <span className="text-[10.5px] font-bold tracking-wide text-[#777] dark:text-foreground/55">
            · {categoryLabel(service.category, locale)}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {price != null && (
          <span className="text-[20px] font-black text-gold leading-none">
            {formatMoneyPrefix(price)}
          </span>
        )}
      </div>
    </button>
  );
}
