'use client';

import { useTranslations } from 'next-intl';
import type { StationDetailData, ServiceForfait, ServiceExtra, TimeSlot } from '@/types/station';

type ArrivalMode = 'queue_now' | 'queue_later' | 'book_slot';

interface SummaryStepProps {
  station: StationDetailData;
  forfait: ServiceForfait;
  selectedExtras: ServiceExtra[];
  arrivalMode: ArrivalMode;
  selectedDate: string | null;
  selectedSlot: TimeSlot | null;
  laterTime: string | null;
  grandTotal: number;
  totalDuration: number;
  onContinue: () => void;
  onBack: () => void;
}

export function SummaryStep({ station, forfait, selectedExtras, arrivalMode, selectedDate, selectedSlot, laterTime, grandTotal, totalDuration, onContinue, onBack }: SummaryStepProps) {
  const t = useTranslations('booking');

  const arrivalLabel = arrivalMode === 'queue_now'
    ? t('summary_queue_now')
    : arrivalMode === 'queue_later'
      ? t('summary_queue_later', { time: laterTime || '' })
      : t('summary_booked_slot', { date: selectedDate || '', time: selectedSlot ? selectedSlot.time : '' });

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
          <h4 className="text-[13px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">{t('summary_service')}</h4>

          <div className="flex justify-between text-[14px]">
            <span className="text-[#000C1F] dark:text-[#FFF8EC] font-semibold">{forfait.name}</span>
            <span className="text-[#000C1F] dark:text-[#FFF8EC] font-bold">{forfait.price}$</span>
          </div>

          {selectedExtras.map((extra) => (
            <div key={extra.id} className="flex justify-between text-[13px]">
              <span className="text-[#555] dark:text-[#B0B0A0]">+ {extra.name}</span>
              <span className="text-[#555] dark:text-[#B0B0A0]">{extra.price}$</span>
            </div>
          ))}
        </div>

        {/* Arrival */}
        <div className="bg-[#E8E8D8] dark:bg-dark-bg/60 rounded-xl p-4">
          <h4 className="text-[13px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">{t('summary_arrival')}</h4>
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
            <span className="font-black text-gold">{grandTotal}$</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-[#D0D0C0] dark:border-tab-inactive pt-4 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
        >
          {t('back')}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg transition-colors cursor-pointer"
        >
          {t('proceed_to_payment')}
        </button>
      </div>
    </div>
  );
}
