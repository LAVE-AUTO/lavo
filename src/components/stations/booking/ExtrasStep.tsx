'use client';

import { useTranslations } from 'next-intl';
import type { ServiceForfait, ServiceExtra } from '@/types/station';

interface ExtrasStepProps {
  forfait: ServiceForfait;
  extras: ServiceExtra[];
  selectedExtras: string[];
  onToggleExtra: (id: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

export function ExtrasStep({ forfait, extras, selectedExtras, onToggleExtra, onContinue, onSkip }: ExtrasStepProps) {
  const t = useTranslations('booking');

  const selectedItems = extras.filter((e) => selectedExtras.includes(e.id));
  const extrasTotal = selectedItems.reduce((sum, e) => sum + e.price, 0);
  const extrasDuration = selectedItems.reduce((sum, e) => sum + e.duration, 0);
  const grandTotal = forfait.price + extrasTotal;
  const totalDuration = forfait.duration + extrasDuration;

  return (
    <div className="flex flex-col h-full">
      {/* Extras grid */}
      <div className="flex-1 overflow-y-auto px-1 space-y-3 pb-4">
        <p className="text-[14px] text-[#555] dark:text-[#B0B0A0] mb-2">
          {t('extras_subtitle')}
        </p>

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
                  : 'border-[#D0D0C0] dark:border-tab-inactive bg-white/40 dark:bg-dark-bg/40 hover:border-gold/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {/* Checkbox */}
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      checked ? 'bg-gold border-gold' : 'border-[#BBB] dark:border-[#555]'
                    }`}>
                      {checked && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </span>
                    <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{extra.name}</span>
                  </div>
                  <p className="text-[13px] text-[#555] dark:text-[#B0B0A0] ml-7">{extra.description}</p>
                  {extra.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                      {extra.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E8E8D8] dark:bg-tab-inactive text-[#555] dark:text-[#CCC] border border-[#D0D0C0] dark:border-tab-inactive">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[16px] font-black text-gold shrink-0">+{extra.price}$</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Ticket summary */}
      <div className="border-t border-[#D0D0C0] dark:border-tab-inactive pt-4 space-y-3">
        <div className="bg-[#E8E8D8] dark:bg-dark-bg/60 rounded-xl p-4 space-y-2">
          <h4 className="text-[13px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">{t('ticket_title')}</h4>

          {/* Base service */}
          <div className="flex justify-between text-[14px]">
            <span className="text-[#000C1F] dark:text-[#FFF8EC] font-semibold">{forfait.name}</span>
            <span className="text-[#000C1F] dark:text-[#FFF8EC] font-bold">{forfait.price}$</span>
          </div>

          {/* Selected extras */}
          {selectedItems.map((item) => (
            <div key={item.id} className="flex justify-between text-[13px]">
              <span className="text-[#555] dark:text-[#B0B0A0]">+ {item.name}</span>
              <span className="text-[#555] dark:text-[#B0B0A0]">{item.price}$</span>
            </div>
          ))}

          {extrasTotal > 0 && (
            <div className="flex justify-between text-[13px] border-t border-[#D0D0C0] dark:border-tab-inactive pt-2 mt-2">
              <span className="text-[#555] dark:text-[#B0B0A0]">{t('ticket_extras_total')}</span>
              <span className="text-gold font-bold">{extrasTotal}$</span>
            </div>
          )}

          {/* Duration */}
          <div className="flex justify-between text-[13px]">
            <span className="text-[#555] dark:text-[#B0B0A0]">{t('ticket_duration')}</span>
            <span className="text-[#555] dark:text-[#B0B0A0] font-semibold">{totalDuration} min</span>
          </div>

          {/* Grand total */}
          <div className="flex justify-between text-[16px] border-t border-[#D0D0C0] dark:border-tab-inactive pt-2 mt-2">
            <span className="font-black text-[#000C1F] dark:text-[#FFF8EC]">{t('ticket_total')}</span>
            <span className="font-black text-gold">{grandTotal}$</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-3 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
          >
            {t('without_extras')}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg transition-colors cursor-pointer"
          >
            {t('continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
