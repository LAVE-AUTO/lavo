'use client';

import { useTranslations } from 'next-intl';
import type {
  StationDetailData,
  StationServicePublic,
  StationServiceEntry,
  StationServiceExtra,
  TimeSlot,
} from '@/types/station';

type ArrivalMode = 'queue_now' | 'queue_later' | 'book_slot';

interface SummaryStepProps {
  station: StationDetailData;
  selectedService: StationServicePublic;
  selectedEntry: StationServiceEntry | null;
  selectedExtras: StationServiceExtra[];
  arrivalMode: ArrivalMode;
  selectedDate: string | null;
  selectedSlot: TimeSlot | null;
  laterTime: string | null;
  grandTotal: number;
  totalDuration: number;
  reservationSurcharge: number | null;
  loading?: boolean;
  error?: string | null;
  onContinue: () => void;
  onBack: () => void;
}

export function SummaryStep({
  station,
  selectedService,
  selectedEntry,
  selectedExtras,
  arrivalMode,
  selectedDate,
  selectedSlot,
  laterTime,
  grandTotal,
  totalDuration,
  reservationSurcharge,
  loading,
  error,
  onContinue,
  onBack,
}: SummaryStepProps) {
  const t = useTranslations('booking');

  const arrivalLabel =
    arrivalMode === 'queue_now'
      ? t('summary_queue_now')
      : arrivalMode === 'queue_later'
        ? t('summary_queue_later', { time: laterTime || '' })
        : t('summary_booked_slot', {
            date: selectedDate || '',
            time: selectedSlot ? selectedSlot.time : '',
          });

  const entryPrice = selectedEntry?.price ?? 0;
  const entryLabel = selectedEntry?.formatLabel ?? selectedService.name;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 space-y-4 pb-4">
        <p className="text-[14px] text-[#555] dark:text-[#B0B0A0]">{t('summary_subtitle')}</p>

        {/* Station */}
        <div className="bg-[#E8E8D8] dark:bg-dark-bg/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            {station.imageUrl && (
              <img src={station.imageUrl} alt={station.name} className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div>
              <h4 className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{station.name}</h4>
              <p className="text-[13px] text-[#555] dark:text-[#B0B0A0]">{station.address}</p>
            </div>
          </div>
        </div>

        {/* Service details */}
        <div className="bg-[#E8E8D8] dark:bg-dark-bg/60 rounded-xl p-4 space-y-2">
          <h4 className="text-[13px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">
            {t('summary_service')}
          </h4>

          <div className="flex justify-between text-[14px]">
            <span className="text-[#000C1F] dark:text-[#FFF8EC] font-semibold">{selectedService.name}</span>
          </div>

          {/* Format line (hand_wash only — when entry has a vehicleFormatId) */}
          {selectedEntry?.vehicleFormatId && (
            <div className="flex justify-between text-[14px]">
              <span className="text-[#555] dark:text-[#B0B0A0]">{entryLabel}</span>
              <span className="text-[#000C1F] dark:text-[#FFF8EC] font-bold">{entryPrice.toLocaleString()}$</span>
            </div>
          )}

          {/* Price for non-hand_wash (no format label) */}
          {!selectedEntry?.vehicleFormatId && entryPrice > 0 && (
            <div className="flex justify-between text-[14px]">
              <span className="text-[#555] dark:text-[#B0B0A0]">{t('summary_base_price')}</span>
              <span className="text-[#000C1F] dark:text-[#FFF8EC] font-bold">{entryPrice.toLocaleString()}$</span>
            </div>
          )}

          {selectedExtras.map((extra) => (
            <div key={extra.id} className="flex justify-between text-[13px]">
              <span className="text-[#555] dark:text-[#B0B0A0]">+ {extra.name}</span>
              <span className="text-[#555] dark:text-[#B0B0A0]">{extra.price.toLocaleString()}$</span>
            </div>
          ))}

          {/* Reservation surcharge — only for book_slot mode */}
          {arrivalMode === 'book_slot' && reservationSurcharge != null && reservationSurcharge > 0 && (
            <div className="flex justify-between text-[13px] border-t border-[#D0D0C0] dark:border-tab-inactive pt-2 mt-1">
              <span className="text-[#555] dark:text-[#B0B0A0]">{t('summary_reservation_surcharge')}</span>
              <span className="text-gold font-bold">+{reservationSurcharge.toLocaleString()}$</span>
            </div>
          )}
        </div>

        {/* Arrival */}
        <div className="bg-[#E8E8D8] dark:bg-dark-bg/60 rounded-xl p-4">
          <h4 className="text-[13px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">
            {t('summary_arrival')}
          </h4>
          <p className="text-[14px] font-semibold text-[#000C1F] dark:text-[#FFF8EC]">{arrivalLabel}</p>
        </div>

        {/* Totals */}
        <div className="bg-gold/10 dark:bg-gold/5 border-2 border-gold rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-[14px]">
            <span className="text-[#555] dark:text-[#B0B0A0]">{t('ticket_duration')}</span>
            <span className="font-bold text-[#000C1F] dark:text-[#FFF8EC]">{totalDuration} min</span>
          </div>
          <div className="flex justify-between text-[18px]">
            <span className="font-black text-[#000C1F] dark:text-[#FFF8EC]">{t('ticket_total')}</span>
            <span className="font-black text-gold">{grandTotal.toLocaleString()}$</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-[#D0D0C0] dark:border-tab-inactive pt-4 space-y-3">
        {error && (
          <p className="text-[13px] text-Hurryline-error text-center">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="flex-1 py-3 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('back')}
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className={`flex-1 py-3 rounded-xl text-[15px] font-black transition-colors cursor-pointer ${
              loading
                ? 'bg-[#D0D0C0] dark:bg-tab-inactive text-[#888] cursor-not-allowed'
                : 'bg-gold hover:bg-gold-hover text-dark-bg'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('summary_creating')}
              </span>
            ) : t('proceed_to_payment')}
          </button>
        </div>
      </div>
    </div>
  );
}
