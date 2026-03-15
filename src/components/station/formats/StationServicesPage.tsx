'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import type { Service, VehicleFormat } from './types';
import { ServiceCard } from './ServiceCard';
import { ServiceModal } from './ServiceModal';

interface StationMeData {
  data: { id: string };
}

interface FormatsData {
  data: VehicleFormat[];
}

// TODO: connect to API once endpoint is available
const INITIAL_SERVICES: Service[] = [];

export function StationServicesPage() {
  const t = useTranslations('station_services');
  const { isLoading: authLoading } = useAuth();

  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [vehicleFormats, setVehicleFormats] = useState<VehicleFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalService, setModalService] = useState<Service | null | 'new'>(null);

  const loadFormats = useCallback(async () => {
    const [meOk, meData] = await getFromApi('/station/me');
    if (meOk) {
      const stationId = (meData as StationMeData).data.id;
      const [formatsOk, formatsData] = await getFromApi(`/stations/${stationId}/formats`);
      if (formatsOk) {
        setVehicleFormats((formatsData as FormatsData).data);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) loadFormats();
  }, [authLoading, loadFormats]);

  function handleSaved(saved: Service) {
    setServices((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setModalService(null);
  }

  function handleDeleted(id: string) {
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  function handleToggled(updated: Service) {
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  const activeCount = services.filter((s) => s.is_active).length;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-[#666] dark:text-[#8A8A7A]">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="border-b border-[#E0DCD0] bg-white px-6 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[16px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</div>
            <div className="text-[12px] text-[#888] dark:text-[#6A6A5A]">{t('page_subtitle')}</div>
          </div>
          <button
            type="button"
            onClick={() => setModalService('new')}
            className="flex items-center gap-2 rounded-[10px] bg-[#C49A1E] px-4 py-2 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('btn_new_service')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-y-auto p-6">
        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="text-[14px] font-semibold text-[#999] dark:text-[#6A6A5A]">{t('empty')}</span>
            <span className="text-[12px] text-[#BBBBAA] dark:text-[#4A4A3A]">{t('empty_hint')}</span>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[11px] font-black tracking-[.08em] text-[#C49A1E] uppercase">
                {t('section_base')}
              </span>
              <span className="text-[11px] text-[#888] dark:text-[#6A6A5A]">
                {t('services_active_count', { count: activeCount })}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onEdit={(s) => setModalService(s)}
                  onDeleted={handleDeleted}
                  onToggled={handleToggled}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modalService !== null && (
        <ServiceModal
          service={modalService === 'new' ? null : modalService}
          vehicleFormats={vehicleFormats}
          onClose={() => setModalService(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
