'use client';

import { useTranslations } from 'next-intl';
import type { StationDetailData, StationServicePublic } from '@/types/station';

interface ServiceSelectionStepProps {
  station: StationDetailData;
  selectedService: StationServicePublic | null;
  onSelectService: (service: StationServicePublic) => void;
  onContinue: () => void;
}

const CATEGORY_KEYS: Record<string, string> = {
  hand_wash: 'cat_hand_wash',
  automatic_wash: 'cat_automatic_wash',
  self_service: 'cat_self_service',
  exterior_wash: 'cat_exterior_wash',
  detailing: 'cat_detailing',
};

export function ServiceSelectionStep({
  station,
  selectedService,
  onSelectService,
  onContinue,
}: ServiceSelectionStepProps) {
  const t = useTranslations('booking');

  const categoryLabel = (cat: string): string => {
    const key = CATEGORY_KEYS[cat];
    return key ? t(key) : cat;
  };

  const services = station.stationServices;

  const minPrice = (svc: StationServicePublic) => {
    const prices = svc.vehicleEntries.map((e) => e.price);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  const minDuration = (svc: StationServicePublic) => {
    const durations = svc.vehicleEntries.map((e) => e.duration);
    return durations.length > 0 ? Math.min(...durations) : null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 space-y-4 pb-4">

        {/* Stats banner */}
        <div className="grid grid-cols-3 gap-2 bg-surface/60 dark:bg-background/50 rounded-xl p-3 border border-border text-center">
          <div>
            <div className="text-[18px] font-black text-foreground leading-none">{station.queueCount}</div>
            <div className="text-[11px] text-foreground/70 mt-0.5">{t('service_stat_queue')}</div>
          </div>
          <div>
            <div className="text-[18px] font-black text-foreground leading-none">{station.availableSlots}</div>
            <div className="text-[11px] text-foreground/70 mt-0.5">{t('service_stat_slots')}</div>
          </div>
          <div>
            <div className="text-[18px] font-black text-foreground leading-none">
              {station.estimatedWaitMinutes > 0 ? `${station.estimatedWaitMinutes}` : '0'}
            </div>
            <div className="text-[11px] text-foreground/70 mt-0.5">{t('service_stat_min_time')}</div>
          </div>
        </div>

        <p className="text-[14px] text-foreground/70">{t('service_selection_subtitle')}</p>

        {services.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/60 dark:bg-background/50 px-5 py-8 text-center text-[14px] text-foreground/70">
            {t('service_no_services')}
          </div>
        ) : (
          <div className="space-y-2.5">
            {services.map((svc) => {
              const selected = selectedService?.id === svc.id;
              const price = minPrice(svc);
              const duration = minDuration(svc);
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => onSelectService(svc)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    selected
                      ? 'border-gold bg-gold/10 dark:bg-gold/5'
                      : 'border-border bg-white/40 dark:bg-background/40 hover:border-gold/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Radio */}
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
                        }`}>
                          {selected && <span className="w-2.5 h-2.5 rounded-full bg-dark-bg" />}
                        </span>
                        <span className="text-[15px] font-bold text-foreground">{svc.name}</span>
                        {svc.isPopular && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gold/20 text-gold border border-gold/30">
                            Populaire
                          </span>
                        )}
                      </div>
                      <div className="ml-7">
                        <span className="text-[12px] text-foreground/55 bg-surface dark:bg-tab-inactive px-2 py-0.5 rounded-full">
                          {categoryLabel(svc.category)}
                        </span>
                        {svc.description && (
                          <p className="text-[13px] text-foreground/70 mt-1.5 line-clamp-2">{svc.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[12px] text-foreground/55">
                          {duration != null && (
                            <span className="flex items-center gap-1">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                              {duration} min
                            </span>
                          )}
                          {svc.extras.length > 0 && (
                            <span>{svc.extras.length} extra{svc.extras.length > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {price != null && (
                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-foreground/55">{t('service_from')}</span>
                        <div className="text-[18px] font-black text-gold">${price.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-border pt-4">
        <button
          type="button"
          disabled={!selectedService}
          onClick={onContinue}
          className={`w-full py-3.5 rounded-xl text-[15px] font-black transition-colors cursor-pointer ${
            selectedService
              ? 'bg-gold hover:bg-gold-hover text-dark-bg'
              : 'bg-[#D0D0C0] dark:bg-tab-inactive text-foreground/55 cursor-not-allowed'
          }`}
        >
          {t('continue')}
        </button>
      </div>
    </div>
  );
}
