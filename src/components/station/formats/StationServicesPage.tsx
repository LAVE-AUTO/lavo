'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import type { StationExtras, StationExtra } from '@/components/station/config/StationExtrasForm';
import type { Service, VehicleFormat } from './types';
import { ServiceCard } from './ServiceCard';
import { ServiceModal } from './ServiceModal';
import { ExtraModal } from './ExtraModal';

interface StationMeData {
  data: { id: string };
}
interface FormatsData {
  data: VehicleFormat[];
}
interface ServicesData {
  data: Service[];
}

// TODO: connect to API once endpoint is available
const INITIAL_SERVICES: Service[] = [
  {
    id: 'mock-exterior',
    name: 'Lavage Extérieur',
    category: 'hand_wash',
    service_type: 'exterior',
    description: 'Lavage extérieur standard',
    is_active: true,
    vehicle_entries: [
      { vehicle_format_id: 'mock-berline', vehicle_label: 'BERLINE', price: '15', duration_min: 20, staff_required: 1, is_active: true },
      { vehicle_format_id: 'mock-suv', vehicle_label: 'SUV', price: '20', duration_min: 25, staff_required: 1, is_active: true },
      { vehicle_format_id: 'mock-compact', vehicle_label: 'COMPACT', price: '15', duration_min: 15, staff_required: 1, is_active: true },
    ],
    compatible_extras: [],
  },
  {
    id: 'mock-complete',
    name: 'Lavage Complet',
    category: 'hand_wash',
    service_type: 'complete',
    description: 'Lavage intérieur et extérieur',
    is_active: true,
    is_popular: true,
    vehicle_entries: [
      { vehicle_format_id: 'mock-berline', vehicle_label: 'BERLINE', price: '25', duration_min: 35, staff_required: 1, is_active: true },
      { vehicle_format_id: 'mock-suv', vehicle_label: 'SUV', price: '35', duration_min: 45, staff_required: 2, is_active: true },
      { vehicle_format_id: 'mock-compact', vehicle_label: 'COMPACT', price: '20', duration_min: 30, staff_required: 1, is_active: true },
    ],
    compatible_extras: [
      { id: 'e1', name: 'Cire protectrice' },
      { id: 'e2', name: 'Polish intérieur' },
      { id: 'e3', name: 'Shampoing tapis' },
    ],
  },
  {
    id: 'mock-premium',
    name: 'Lavage Premium',
    category: 'hand_wash',
    service_type: 'complete',
    description: 'Service premium longue durée',
    is_active: true,
    vehicle_entries: [
      { vehicle_format_id: 'mock-berline', vehicle_label: 'BERLINE', price: '45', duration_min: 60, staff_required: 2, is_active: true },
      { vehicle_format_id: 'mock-suv', vehicle_label: 'SUV', price: '65', duration_min: 75, staff_required: 2, is_active: true },
      { vehicle_format_id: 'mock-compact', vehicle_label: 'COMPACT', price: '40', duration_min: 55, staff_required: 2, is_active: true },
    ],
    compatible_extras: [],
  },
];
const INITIAL_EXTRAS: StationExtras = {
  exterior: [
    { id: 'extra-cire', label: 'Cire protectrice', description: '', price: '15', is_active: true },
  ],
  interior: [
    { id: 'extra-polish', label: 'Polish intérieur', description: '', price: '12', is_active: true },
  ],
  both: [
    { id: 'extra-shampoo', label: 'Shampoing tapis', description: '', price: '8', is_active: true },
  ],
};

export function StationServicesPage() {
  const t = useTranslations('station_services');
  const { isLoading: authLoading } = useAuth();

  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [formats, setFormats] = useState<VehicleFormat[]>([]);
  const [extras, setExtras] = useState<StationExtras>(INITIAL_EXTRAS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [serviceModal, setServiceModal] = useState<Service | null | 'new'>(null);
  const [extraModal, setExtraModal] = useState<StationExtra | null | 'new'>(null);
  const [bookingMarkupEnabled, setBookingMarkupEnabled] = useState(true);
  const [bookingMarkupType, setBookingMarkupType] = useState<'fixed' | 'percent'>('fixed');
  const [bookingMarkupAmount, setBookingMarkupAmount] = useState('10');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [meOk, meData] = await getFromApi('/station/me');
    if (!meOk) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    const stationId = (meData as StationMeData).data.id;
    const [servicesOk, servicesData] = await getFromApi('/station/services');
    if (servicesOk && Array.isArray((servicesData as ServicesData).data)) {
      setServices((servicesData as ServicesData).data);
    } else {
      // TODO: remove fallback when GET /station/services is available in all environments
      setServices(INITIAL_SERVICES);
    }

    const [formatsOk, formatsData] = await getFromApi(`/stations/${stationId}/formats`);
    if (formatsOk) setFormats((formatsData as FormatsData).data);
    else setLoadError(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  const handleServiceSaved = useCallback((saved: Service) => {
    setServices((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx !== -1) { const next = [...prev]; next[idx] = saved; return next; }
      return [...prev, saved];
    });
    setServiceModal(null);
  }, []);

  const handleServiceDeleted = useCallback((id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleServiceToggled = useCallback((updated: Service) => {
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const activeCount = services.filter((s) => s.is_active).length;
  const allExtras = [...extras.exterior, ...extras.interior, ...extras.both];
  const previewQueuePrice = 25;
  const parsedMarkup = parseFloat(bookingMarkupAmount || '0');
  const safeMarkup = Number.isNaN(parsedMarkup) ? 0 : parsedMarkup;
  const previewOnlinePrice = bookingMarkupEnabled
    ? bookingMarkupType === 'percent'
      ? (previewQueuePrice * (1 + safeMarkup / 100)).toFixed(2)
      : (previewQueuePrice + safeMarkup).toFixed(2)
    : previewQueuePrice.toFixed(2);
  const markupDisplay = bookingMarkupEnabled
    ? bookingMarkupType === 'percent'
      ? `+${safeMarkup}%`
      : `+${safeMarkup}$`
    : null;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-[#666] dark:text-[#A0A090]">
        {t('loading')}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-[14px] font-semibold text-[#999] dark:text-[#9A9A8A]">{t('load_error')}</span>
        <button
          type="button"
          onClick={loadData}
          className="rounded-[10px] border border-[#C49A1E]/50 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] transition-all hover:border-[#C49A1E] hover:bg-[#FDF8EC] dark:hover:bg-[#1A1A08]"
        >
          {t('btn_retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="border-b border-[#E0DCD0] bg-white px-6 pt-5 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="flex items-center justify-between pb-4">
          <div>
            <div className="text-[22px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</div>
            <div className="text-[13px] text-[#888] dark:text-[#9A9A8A]">{t('page_subtitle')}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-[8px] border border-[#2A3A20] bg-[#1E2A18] px-4 py-2 text-[12px] font-bold text-[#F0EDD4] transition-colors hover:bg-[#243220]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 14l3-3 3 2 4-5" />
              </svg>
              {t('btn_stats')}
            </button>
            <button
              type="button"
              onClick={() => setServiceModal('new')}
              className="flex items-center gap-2 rounded-[8px] bg-[#C49A1E] px-4 py-2 text-[13px] font-black text-[#0C1209] transition-opacity hover:opacity-80"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('btn_new_service')}
            </button>
          </div>
        </div>
      </div>

      {/* Services content */}
      <div className="flex flex-1 flex-col overflow-y-auto p-6">
        {/* Booking markup section */}
        <div className={`mb-5 rounded-[14px] border transition-colors ${
          bookingMarkupEnabled
            ? 'border-[#C49A1E]/40 bg-[#FFFDF5] dark:border-[#C49A1E]/20 dark:bg-[#100F00]'
            : 'border-[#E0DCD0] bg-[#F7F6F2] dark:border-[#1E2A14] dark:bg-[#0C110A]'
        }`}>
          {/* Header row */}
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                bookingMarkupEnabled ? 'bg-[#C49A1E]/15' : 'bg-[#E8E5DE] dark:bg-[#1A2014]'
              }`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={bookingMarkupEnabled ? '#C49A1E' : '#888'} strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 17l10 5 10-5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <div className="text-[14px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('booking_markup_title')}</div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-[#888] dark:text-[#7A7A6A]">{t('booking_markup_hint')}</div>
              </div>
            </div>
            {/* Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={bookingMarkupEnabled}
              onClick={() => setBookingMarkupEnabled((v) => !v)}
              className={`relative mt-1 flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all ${
                bookingMarkupEnabled
                  ? 'border-[#C49A1E] bg-[#C49A1E]'
                  : 'border-[#CCC] bg-[#E8E5DE] dark:border-[#3A3A2A] dark:bg-[#1A2014]'
              }`}
            >
              <span className={`absolute h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                bookingMarkupEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Controls — visible only when enabled */}
          {bookingMarkupEnabled && (
            <div className="border-t border-[#C49A1E]/20 px-5 py-4 dark:border-[#C49A1E]/10">
              <div className="flex flex-wrap items-end gap-3">
                {/* Type selector */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black tracking-[.08em] text-[#7A7A6A] uppercase dark:text-[#7A7A6A]">
                    {t('booking_markup_type')}
                  </span>
                  <div className="flex overflow-hidden rounded-[8px] border border-[#D8D4C8] bg-white dark:border-[#2A3A20] dark:bg-[#182214]">
                    {(['fixed', 'percent'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBookingMarkupType(type)}
                        className={`px-4 py-2 text-[12px] font-black transition-colors ${
                          bookingMarkupType === type
                            ? 'bg-[#C49A1E] text-[#0C1209]'
                            : 'text-[#5A5A4A] hover:bg-[#F0EDD4] dark:text-[#9A9A8A] dark:hover:bg-[#1A2014]'
                        }`}
                      >
                        {type === 'fixed' ? '$' : '%'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount input */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black tracking-[.08em] text-[#7A7A6A] uppercase dark:text-[#7A7A6A]">
                    {t('booking_markup_amount')}
                  </span>
                  <div className="flex items-center overflow-hidden rounded-[8px] border border-[#D8D4C8] bg-white transition-colors focus-within:border-[#C49A1E] dark:border-[#2A3A20] dark:bg-[#182214]">
                    <span className="border-r border-[#E0DCD0] bg-[#F7F6F2] px-3 py-2 text-[12px] font-bold text-[#888] dark:border-[#2A3A20] dark:bg-[#111A0E] dark:text-[#7A7A6A]">
                      {bookingMarkupType === 'fixed' ? '$' : '%'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={bookingMarkupType === 'percent' ? '100' : undefined}
                      step={bookingMarkupType === 'percent' ? '0.5' : '1'}
                      value={bookingMarkupAmount}
                      onChange={(e) => setBookingMarkupAmount(e.target.value)}
                      className="w-[88px] bg-transparent px-3 py-2 text-[13px] font-bold text-[#1A1A0A] outline-none dark:text-[#F0EDD4]"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="flex flex-1 items-center gap-3 rounded-[10px] border border-[#C49A1E]/25 bg-[#C49A1E]/5 px-4 py-2.5">
                  <div className="text-center">
                    <div className="text-[10px] font-bold tracking-[.06em] text-[#888] uppercase dark:text-[#7A7A6A]">{t('booking_markup_queue')}</div>
                    <div className="text-[18px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{previewQueuePrice}$</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
                      <path d="M0 5h14M10 1l4 4-4 4" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {markupDisplay && (
                      <span className="rounded-full bg-[#C49A1E]/15 px-2 py-0.5 text-[10px] font-black text-[#C49A1E]">
                        {markupDisplay}
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold tracking-[.06em] text-[#888] uppercase dark:text-[#7A7A6A]">{t('booking_markup_online')}</div>
                    <div className="text-[18px] font-black text-[#C49A1E]">{previewOnlinePrice}$</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="text-[14px] font-semibold text-[#999] dark:text-[#9A9A8A]">{t('empty')}</span>
            <span className="text-[13px] text-[#BBBBAA] dark:text-[#4A4A3A]">{t('empty_hint')}</span>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[11px] font-black tracking-[.1em] text-[#C09A18] uppercase">{t('section_base')}</span>
              <span className="text-[11px] font-medium text-[#888] dark:text-[#9A9A8A]">{t('services_active_count', { count: activeCount })}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {services.map((service, index) => (
                <div
                  key={service.id}
                  className={services.length % 2 === 1 && index === services.length - 1 ? 'lg:col-span-2' : ''}
                >
                  <ServiceCard
                    service={service}
                    onEdit={setServiceModal}
                    onDeleted={handleServiceDeleted}
                    onToggled={handleServiceToggled}
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black tracking-[.1em] text-[#C09A18] uppercase">{t('extras_label')}</span>
                <span className="text-[11px] font-medium text-[#888] dark:text-[#9A9A8A]">{allExtras.length} configuré(s)</span>
              </div>
              <button
                type="button"
                onClick={() => setExtraModal('new')}
                className="rounded-[8px] border border-[#2A3A20] bg-[#1E2A18] px-3 py-1.5 text-[12px] font-bold text-[#F0EDD4] transition-colors hover:bg-[#243220]"
              >
                + Extra
              </button>
            </div>

            {allExtras.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[#E0DCD4] py-6 text-center text-[13px] text-[#BBBBAA] dark:border-[#243020] dark:text-[#4A4A3A]">
                {t('extras_none')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {allExtras.map((extra) => (
                  <div
                    key={extra.id}
                    className="rounded-[10px] border border-[#EDEBE5] bg-[#FAFAF7] p-3 dark:border-[#243020] dark:bg-[#0D170A]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{extra.label}</div>
                        <div className="mt-0.5 text-[11px] text-[#C49A1E]">+{extra.price}$</div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        extra.is_active
                          ? 'bg-[rgba(46,204,113,.12)] text-[#2ecc71]'
                          : 'bg-[rgba(136,136,136,.12)] text-[#888]'
                      }`}>
                        {extra.is_active ? t('badge_active') : t('badge_inactive')}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExtraModal(extra)}
                        className="rounded-[6px] border border-[#D8D4C8] px-2.5 py-1 text-[10px] font-semibold text-[#5A5A4A] dark:border-[#243020] dark:text-[#9A9A8A]"
                      >
                        {t('btn_edit')}
                      </button>
                      <button
                        type="button"
                        className="rounded-[6px] border border-[#FF2525] px-2.5 py-1 text-[10px] font-semibold text-[#FF2525]"
                      >
                        {t('btn_delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Service modal */}
      {serviceModal !== null && (
        <ServiceModal
          service={serviceModal === 'new' ? null : serviceModal}
          vehicleFormats={formats}
          availableExtras={extras}
          onClose={() => setServiceModal(null)}
          onSaved={handleServiceSaved}
        />
      )}

      {extraModal !== null && (
        <ExtraModal
          extra={extraModal === 'new' ? null : extraModal}
          vehicleFormats={formats}
          services={services}
          onClose={() => setExtraModal(null)}
          onSaved={(saved) => {
            // TODO: connect to API once endpoint is available — update local extras state
            setExtraModal(null);
          }}
        />
      )}
    </div>
  );
}
