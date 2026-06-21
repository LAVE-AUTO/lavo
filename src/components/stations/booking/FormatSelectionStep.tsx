'use client';

import { useTranslations } from 'next-intl';
import type { StationServicePublic, StationServiceEntry } from '@/types/station';

interface FormatSelectionStepProps {
  service: StationServicePublic;
  selectedEntry: StationServiceEntry | null;
  onSelectEntry: (entry: StationServiceEntry) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function FormatSelectionStep({
  service,
  selectedEntry,
  onSelectEntry,
  onContinue,
  onBack,
}: FormatSelectionStepProps) {
  const t = useTranslations('booking');

  const activeEntries = service.vehicleEntries.filter((e) => e.vehicleFormatId != null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 space-y-4 pb-4">
        <p className="text-[14px] text-foreground/70">{t('format_selection_subtitle')}</p>

        {/* Service name reminder */}
        <div className="flex items-center gap-2 px-1">
          <div className="w-2 h-2 rounded-full bg-gold shrink-0" />
          <span className="text-[14px] font-bold text-foreground">{service.name}</span>
        </div>

        {activeEntries.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/60 dark:bg-background/50 px-5 py-8 text-center text-[14px] text-foreground/70">
            {t('format_none')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {activeEntries.map((entry) => {
              const selected = selectedEntry?.id === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    selected
                      ? 'border-gold bg-gold/10 dark:bg-gold/5'
                      : 'border-border bg-white/40 dark:bg-background/40 hover:border-gold/30'
                  }`}
                >
                  {/* Selected indicator */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selected ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
                    }`}>
                      {selected && <span className="w-2.5 h-2.5 rounded-full bg-dark-bg" />}
                    </span>
                    <span className="text-[18px] font-black text-gold">${entry.price.toLocaleString()}</span>
                  </div>

                  {/* Format name */}
                  <div className="text-[15px] font-bold text-foreground leading-tight mb-1">
                    {entry.formatLabel}
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-1 text-[12px] text-foreground/55">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {entry.duration} min
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Note */}
        <p className="text-[12px] text-foreground/55 dark:text-[#777] px-1">
          {t('format_selection_note')}
        </p>
      </div>

      {/* Actions */}
      <div className="border-t border-border pt-4 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
        >
          {t('back')}
        </button>
        <button
          type="button"
          disabled={!selectedEntry}
          onClick={onContinue}
          className={`flex-1 py-3 rounded-xl text-[15px] font-black transition-colors cursor-pointer ${
            selectedEntry
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
