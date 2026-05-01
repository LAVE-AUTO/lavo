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
