'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { getFromApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import type { StationExtras, StationExtra } from '@/components/station/config/station-extras-types';
import type { Service, VehicleFormat } from './types';
import { ServiceCard } from './ServiceCard';
import { ExtraCard } from './ExtraCard';
import { ServiceModal } from './ServiceModal';
import { ExtraModal } from './ExtraModal';
import { PageLoader } from '@/components/ui/PageLoader';

interface StationMeData {
  data: { id: string };
}
interface FormatsData {
  data: { items: VehicleFormat[] };
}
interface ServicesData {
  data: { items: Service[] };
}
interface RawExtra {
  id: string;
  label: string;
  price: string;
  scope: 'exterior' | 'interior' | 'both';
  duration_min: number;
  staff_required: number;
  is_active: boolean;
}
interface ExtrasData {
  data: { items: RawExtra[] };
}

function groupExtras(raw: RawExtra[]): StationExtras {
  const result: StationExtras = { exterior: [], interior: [], both: [] };
  for (const e of raw) {
    const extra: StationExtra = {
      id: e.id,
      label: e.label,
      description: '',
      price: e.price,
      is_active: e.is_active,
      scope: e.scope,
      duration_min: e.duration_min,
      staff_required: e.staff_required,
    };
    result[e.scope ?? 'both'].push(extra);
  }
  return result;
}

const StatsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3v18h18" />
    <path d="M7 14l3-3 3 2 4-5" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export function StationServicesPage() {
  const t = useTranslations('station_services');
  const locale = useLocale();
  const { isLoading: authLoading } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [formats, setFormats] = useState<VehicleFormat[]>([]);
  const [extras, setExtras] = useState<StationExtras>({ exterior: [], interior: [], both: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [serviceModal, setServiceModal] = useState<Service | null | 'new'>(null);
  const [extraModal, setExtraModal] = useState<StationExtra | null | 'new'>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    const [meResult, servicesResult, extrasResult, formatsResult] = await Promise.all([
      getFromApi('/station/me'),
      getFromApi('/station/services?limit=100'),
      getFromApi('/station/extras?limit=100'),
      getFromApi('/formats?page=1&per_page=100'),
    ]);

    const [meOk] = meResult;
    const [servicesOk, servicesData] = servicesResult;
    const [extrasOk, extrasData] = extrasResult;
    const [formatsOk, formatsData] = formatsResult;

    if (!meOk) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    if (servicesOk) {
      const items = (servicesData as ServicesData).data?.items ?? [];
      setServices(items);
    }

    if (extrasOk) {
      const items = (extrasData as ExtrasData).data?.items ?? [];
      setExtras(groupExtras(items));
    }

    if (formatsOk) setFormats((formatsData as FormatsData).data?.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  const handleServiceSaved = useCallback((saved: Service) => {
    setServices((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
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

  const allExtras: StationExtra[] = [...extras.exterior, ...extras.interior, ...extras.both];

  const handleExtraDeleted = useCallback((id: string) => {
    setExtras((prev) => ({
      exterior: prev.exterior.filter((e) => e.id !== id),
      interior: prev.interior.filter((e) => e.id !== id),
      both: prev.both.filter((e) => e.id !== id),
    }));
  }, []);

  const handleExtraToggled = useCallback((updated: StationExtra) => {
    const map = (list: StationExtra[]) => list.map((e) => (e.id === updated.id ? updated : e));
    setExtras((prev) => ({
      exterior: map(prev.exterior),
      interior: map(prev.interior),
      both: map(prev.both),
    }));
  }, []);

  const activeServiceCount = services.filter((s) => s.is_active).length;
  const activeExtraCount = allExtras.filter((e) => e.is_active).length;

  if (loading) {
    return <PageLoader label={t('loading')} />;
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-[14px] font-semibold text-[#999] dark:text-[#B0BFB1]">{t('load_error')}</span>
        <button
          type="button"
          onClick={loadData}
          className="rounded-xl border border-[#DDAF3B]/50 px-4 py-2 text-[13px] font-semibold text-[#DDAF3B] transition-all hover:border-[#DDAF3B] hover:bg-[#FDF8EC] dark:hover:bg-[#1A1A08]"
        >
          {t('btn_retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Topbar */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D8CCA0] bg-transparent px-6 py-5 dark:border-[#1A2A14] dark:bg-dark-bg">
        <div className="min-w-0">
          <h1 className="text-[22px] font-black tracking-tight text-[#001201] dark:text-[#FFF9EC]">
            {t('page_title')}
          </h1>
          <p className="mt-0.5 text-[13px] text-foreground/55 dark:text-[#B0BFB1]">{t('page_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/station/analytics`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFF9EC] bg-white px-4 py-2 text-[12px] font-bold text-[#5A5A4A] transition-colors hover:border-[#DDAF3B]/40 hover:text-[#DDAF3B] dark:border-[#001A05] dark:bg-[#182214] dark:text-[#B0BFB1]"
          >
            <StatsIcon />
            {t('btn_stats')}
          </Link>
          <button
            type="button"
            onClick={() => setServiceModal('new')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#DDAF3B] px-4 py-2 text-[12px] font-bold text-[#001201] transition-opacity hover:opacity-85"
          >
            <PlusIcon />
            {t('btn_new_service')}
          </button>
        </div>
      </header>

      {/* Main scroll area */}
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
        {/* Services section */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[11px] font-black uppercase tracking-[1.5px] text-[#DDAF3B]">
              {t('section_base')}
            </h2>
            <span className="text-[12px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">
              {t('services_active_count', { count: activeServiceCount })}
            </span>
          </div>

          {services.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#FFF9EC] py-16 text-center dark:border-[#001A05]">
              <span className="text-[14px] font-semibold text-[#999] dark:text-[#B0BFB1]">{t('empty')}</span>
              <span className="text-[13px] text-[#BBBBAA] dark:text-[#5A5A4A]">{t('empty_hint')}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {services.map((service) => {
                const isFullWidth = service.category === 'automatic';
                return (
                  <div key={service.id} className={isFullWidth ? 'lg:col-span-2' : ''}>
                    <ServiceCard
                      service={service}
                      onEdit={setServiceModal}
                      onDeleted={handleServiceDeleted}
                      onToggled={handleServiceToggled}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Extras section */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-[11px] font-black uppercase tracking-[1.5px] text-[#DDAF3B]">
                {t('section_extras_available')}
              </h2>
              <span className="text-[12px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">
                {t('extras_active_count', { active: activeExtraCount, total: allExtras.length })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setExtraModal('new')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#DDAF3B] px-3 py-1.5 text-[11px] font-bold text-[#001201] transition-opacity hover:opacity-85"
            >
              <PlusIcon />
              {t('btn_new_extra')}
            </button>
          </div>

          {allExtras.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#FFF9EC] py-12 text-center dark:border-[#001A05]">
              <span className="text-[13px] text-[#BBBBAA] dark:text-[#4A4A3A]">{t('extras_none')}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {allExtras.map((extra) => (
                <ExtraCard
                  key={extra.id}
                  extra={extra}
                  onEdit={setExtraModal}
                  onDeleted={handleExtraDeleted}
                  onToggled={handleExtraToggled}
                />
              ))}
            </div>
          )}
        </section>
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

      {/* Extra modal */}
      {extraModal !== null && (
        <ExtraModal
          extra={extraModal === 'new' ? null : extraModal}
          onClose={() => setExtraModal(null)}
          onSaved={(saved) => {
            const scope = saved.scope ?? 'both';
            setExtras((prev) => {
              const isEdit = extraModal !== 'new';
              if (isEdit) {
                // Replace the updated extra in whichever bucket it was in
                const removeFrom = (list: StationExtra[]) => list.filter((e) => e.id !== saved.id);
                const updated = {
                  exterior: removeFrom(prev.exterior),
                  interior: removeFrom(prev.interior),
                  both: removeFrom(prev.both),
                };
                updated[scope] = [...updated[scope], saved];
                return updated;
              }
              // New extra: add to the right scope bucket
              return { ...prev, [scope]: [...prev[scope], saved] };
            });
            setExtraModal(null);
          }}
        />
      )}
    </div>
  );
}
