'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { PageLoader } from '@/components/ui/PageLoader';
import { VehicleFormatsTab } from '@/components/station/formats/VehicleFormatsTab';
import type { VehicleFormat } from '@/components/station/formats/types';

interface FormatsResponse {
  data: { items: VehicleFormat[] };
}

/**
 * Admin management of the GLOBAL vehicle format catalog. Formats are owned by
 * the admin; stations only select from this list when building their services.
 * Uniqueness is case-insensitive, so the same format cannot be added twice.
 */
export function AdminVehicleFormatsView() {
  const t = useTranslations('admin_dashboard');

  const [formats, setFormats] = useState<VehicleFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const loadFormats = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [ok, data] = await getFromApi<FormatsResponse>('/admin/formats');
    if (!mountedRef.current) return;
    if (ok) {
      setFormats((data as FormatsResponse).data?.items ?? []);
    } else {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadFormats(); }, [loadFormats]);

  const handleAdd = (format: VehicleFormat) => setFormats((prev) => [...prev, format]);
  const handleUpdate = (format: VehicleFormat) =>
    setFormats((prev) => prev.map((f) => (f.id === format.id ? format : f)));
  const handleDelete = (id: string) => setFormats((prev) => prev.filter((f) => f.id !== id));

  if (loading) return <PageLoader label={t('vehicle_formats_loading')} />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-[20px] font-black tracking-tight text-foreground">{t('vehicle_formats_title')}</h1>
        <p className="mt-1 text-[13px] text-foreground/60">{t('vehicle_formats_subtitle')}</p>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-2xl border border-Hurryline-error/30 bg-Hurryline-error/10 px-4 py-6 text-center"
        >
          <p className="text-[13px] font-semibold text-Hurryline-error">{t('vehicle_formats_load_error')}</p>
          <button
            type="button"
            onClick={loadFormats}
            className="rounded-xl border border-gold/50 px-4 py-2 text-[13px] font-bold text-gold transition-colors hover:bg-gold/10"
          >
            {t('vehicle_formats_retry')}
          </button>
        </div>
      ) : (
        <section className="rounded-2xl border border-separator/25 bg-card-surface p-4 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214] sm:p-6">
          <VehicleFormatsTab
            formats={formats}
            apiBasePath="/admin/formats"
            showPrice={false}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </section>
      )}
    </div>
  );
}
