'use client';

import { useTranslations } from 'next-intl';
import type { StationServiceExtra } from '@/types/station';

interface ExtrasStepProps {
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  extras: StationServiceExtra[];
  selectedExtras: string[];
  onToggleExtra: (id: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export function ExtrasStep({
  serviceName,
  servicePrice,
  serviceDuration,
  extras,
  selectedExtras,
  onToggleExtra,
  onContinue,
  onSkip,
  onBack,
}: ExtrasStepProps) {
  const t = useTranslations('booking');

  const selectedItems = extras.filter((e) => selectedExtras.includes(e.id));
  const extrasTotal = selectedItems.reduce((sum, e) => sum + e.price, 0);
  const extrasDuration = selectedItems.reduce((sum, e) => sum + e.duration, 0);
  const grandTotal = servicePrice + extrasTotal;
  const totalDuration = serviceDuration + extrasDuration;

  return (
    <div>
      {/* Extras grid */}
      <div className="px-1 pb-4">
        <p className="text-[14px] text-foreground/70 mb-3">
          {t('extras_subtitle')}
        </p>

        {extras.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/60 dark:bg-background/50 px-5 py-8 text-center text-[14px] text-foreground/70">
            {t('extras_no_extras')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {extras.map((extra) => {
              const checked = selectedExtras.includes(extra.id);
              return (
                <button
                  key={extra.id}
                  type="button"
                  onClick={() => onToggleExtra(extra.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    checked
                      ? 'border-gold bg-gold/10 dark:bg-gold/5'
                      : 'border-border bg-white/40 dark:bg-background/40 hover:border-gold/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          checked ? 'bg-gold border-gold' : 'border-[#BBB] dark:border-[#555]'
                        }`}>
                          {checked && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </span>
                        <span className="text-[15px] font-bold text-foreground">{extra.name}</span>
                      </div>
                      <div className="ml-7 space-y-1">
                        <div className="flex items-center gap-1 text-[12px] text-foreground/55">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          {extra.duration} min
                          <span className="mx-1">·</span>
                          <span className="capitalize">{extra.scope}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[16px] font-black text-gold shrink-0">+${extra.price.toLocaleString()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket summary */}
      <div className="border-t border-border pt-4 space-y-3 px-1">
        <div className="bg-surface dark:bg-background/60 rounded-xl p-4 space-y-2">
          <h4 className="text-[13px] font-bold text-foreground/70 dark:text-[#A0A090] uppercase tracking-wider mb-2">{t('ticket_title')}</h4>

          <div className="flex justify-between text-[14px]">
            <span className="text-foreground font-semibold">{serviceName}</span>
            <span className="text-foreground font-bold">${servicePrice.toLocaleString()}</span>
          </div>

          {selectedItems.map((item) => (
            <div key={item.id} className="flex justify-between text-[13px]">
              <span className="text-foreground/70">+ {item.name}</span>
              <span className="text-foreground/70">${item.price.toLocaleString()}</span>
            </div>
          ))}

          {extrasTotal > 0 && (
            <div className="flex justify-between text-[13px] border-t border-border pt-2 mt-2">
              <span className="text-foreground/70">{t('ticket_extras_total')}</span>
              <span className="text-gold font-bold">${extrasTotal.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between text-[13px]">
            <span className="text-foreground/70">{t('ticket_duration')}</span>
            <span className="text-foreground/70 font-semibold">{totalDuration} min</span>
          </div>

          <div className="flex justify-between text-[16px] border-t border-border pt-2 mt-2">
            <span className="font-black text-foreground">{t('ticket_total')}</span>
            <span className="font-black text-gold">${grandTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-2">
          <button
            type="button"
            onClick={onBack}
            className="py-3 px-4 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
          >
            {t('back')}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-3 border-2 border-border rounded-xl text-[15px] font-bold text-foreground/70 hover:border-gold/30 transition-colors cursor-pointer"
          >
            {t('without_extras')}
          </button>
          {extras.length > 0 && (
            <button
              type="button"
              onClick={onContinue}
              className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg transition-colors cursor-pointer"
            >
              {t('continue')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
