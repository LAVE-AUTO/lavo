'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, postWithApi } from '@/services';
import { Modal } from '@/components/ui/Modal';

interface ServiceVehicleEntry {
  id: string;
  vehicle_format_id: string | null;
  vehicle_label: string;
  price: string;
  duration_min: number;
  is_active: boolean;
}

interface StationService {
  id: string;
  name: string;
  category: string;
  service_type: string;
  is_active: boolean;
  vehicle_entries: ServiceVehicleEntry[];
}

interface ServicesEnvelope {
  data?: { items?: StationService[] };
}

interface ManualQueueAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the newly created entry id so the parent can refresh. */
  onSuccess: (entryId: string) => void;
}

/* Service categories localised the same way as /stations/[id] and the
 * client cards so the merchant sees consistent wording. */
const CATEGORY_LABELS: Record<string, string> = {
  hand_wash:    'Lavage à la main',
  automatic:    'Lavage automatique',
  self_service: 'Self-service',
};

/**
 * Walk-in entry creation for the station merchant.
 *
 * The form is service-first: the merchant picks a station service
 * (Lavage Premium, Forfait Complet…), then the vehicle format select
 * is scoped to the service's own vehicle entries, then optionally a
 * time slot for a same-day reservation. Submitting calls POST
 * /station/entries with service_id + vehicle_format_id + optional
 * time_slot_id so the new entry is snapshooted with the right service
 * and reads correctly on the dashboard / history cards.
 */
export function ManualQueueAddModal({
  isOpen,
  onClose,
  onSuccess,
}: ManualQueueAddModalProps) {
  const t = useTranslations('station_dashboard');

  const [services, setServices] = useState<StationService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState(false);

  const [serviceId, setServiceId] = useState('');
  const [formatId, setFormatId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* Fetch services once when the modal opens. We re-fetch on every
   * reopen so the merchant always sees the latest list, even if they
   * just edited their catalogue from another tab. */
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setServicesLoading(true);
    setServicesError(false);
    (async () => {
      const [ok, data] = await getFromApi<ServicesEnvelope>('/station/services?limit=100');
      if (cancelled) return;
      if (!ok) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[ManualQueueAddModal] /station/services failed', data);
        }
        setServicesError(true);
        setServicesLoading(false);
        return;
      }
      /* The endpoint returns { data: { items, next_cursor, has_more } }.
       * Read defensively so a one-off payload shape change does not
       * blank the modal. */
      const envelope = data as ServicesEnvelope | { items?: StationService[] } | null;
      const rawItems =
        (envelope && typeof envelope === 'object' && 'data' in envelope
          ? envelope.data?.items
          : (envelope as { items?: StationService[] } | null)?.items) ?? [];

      /* Only show active services with at least one active vehicle entry. */
      const usable = rawItems.filter(
        (s) => s && s.is_active && Array.isArray(s.vehicle_entries) && s.vehicle_entries.some((e) => e.is_active),
      );
      setServices(usable);
      setServicesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  /* Reset form state every time the modal closes so the next open
   * starts clean. */
  useEffect(() => {
    if (isOpen) return;
    setServiceId('');
    setFormatId('');
    setSubmitError(null);
    setIsSubmitting(false);
  }, [isOpen]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  /* Auto-select the first active entry when a service is picked. */
  useEffect(() => {
    if (!selectedService) {
      setFormatId('');
      return;
    }
    const firstActive = selectedService.vehicle_entries.find(
      (e) => e.is_active && e.vehicle_format_id,
    );
    setFormatId(firstActive?.vehicle_format_id ?? '');
  }, [selectedService]);

  const canSubmit = serviceId && formatId && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const [ok, data] = await postWithApi('/station/entries', {
      service_id: serviceId,
      vehicle_format_id: formatId,
    });
    if (!ok) {
      setIsSubmitting(false);
      const code = (data as { code?: string } | null)?.code;
      setSubmitError(
        code === 'VALIDATION_FAILED'
          ? t('manual_queue_error_format')
          : t('manual_queue_error_unavailable'),
      );
      return;
    }
    const entryId = (data as { data?: { id?: string } } | null)?.data?.id;
    setIsSubmitting(false);
    onSuccess(entryId ?? '');
    onClose();
  }, [canSubmit, formatId, onClose, onSuccess, serviceId, t]);

  return (
    <Modal open={isOpen} onClose={onClose} title={t('manual_queue_title')}>
      <div className="space-y-5 px-5 py-5">
        <p className="text-[13px] leading-relaxed text-foreground/65">
          {t('manual_queue_subtitle')}
        </p>

        {/* Service picker */}
        <ServicePickerBlock
          services={services}
          servicesLoading={servicesLoading}
          servicesError={servicesError}
          selectedServiceId={serviceId}
          onSelect={setServiceId}
          t={t}
        />

        {/* Vehicle format picker — locked to the chosen service entries */}
        {selectedService && (
          <FormatPickerBlock
            service={selectedService}
            selectedFormatId={formatId}
            onSelect={setFormatId}
            t={t}
          />
        )}

        {/* Error banner */}
        {submitError && (
          <div
            role="alert"
            className="rounded-xl border border-Hurryline-error/30 bg-Hurryline-error/10 px-3.5 py-2.5 text-[13px] font-semibold text-Hurryline-error"
          >
            {submitError}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-[14px] font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50"
          >
            {t('confirm_btn_cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-shine flex-1 rounded-xl bg-gold px-4 py-2.5 text-[14px] font-bold text-background transition-all hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('loading') : t('manual_queue_add_button')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-blocks                                                          */
/* ------------------------------------------------------------------ */

interface ServicePickerBlockProps {
  services: StationService[];
  servicesLoading: boolean;
  servicesError: boolean;
  selectedServiceId: string;
  onSelect: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}

function ServicePickerBlock({
  services,
  servicesLoading,
  servicesError,
  selectedServiceId,
  onSelect,
  t,
}: ServicePickerBlockProps) {
  if (servicesLoading) {
    return (
      <div className="rounded-2xl border border-border bg-surface/60 px-4 py-6 text-center text-[13px] font-semibold text-foreground/70">
        {t('manual_queue_services_loading')}
      </div>
    );
  }

  if (servicesError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-Hurryline-error/30 bg-Hurryline-error/10 px-4 py-4 text-center text-[13px] font-semibold text-Hurryline-error"
      >
        {t('manual_queue_services_error')}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface/60 px-4 py-6 text-center text-[13px] font-semibold text-foreground/70">
        {t('manual_queue_services_empty')}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-foreground/65 mb-2">
        {t('manual_queue_service_label')}
        <span className="text-Hurryline-error ml-1">*</span>
      </label>
      <div role="radiogroup" className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
        {services.map((svc) => {
          const isSelected = svc.id === selectedServiceId;
          return (
            <button
              key={svc.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(svc.id)}
              className={[
                'w-full text-left rounded-xl border-[1.5px] p-3.5 transition-colors cursor-pointer',
                isSelected
                  ? 'border-gold bg-gold/10'
                  : 'border-border bg-surface hover:border-gold/40',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-bold text-foreground truncate">
                    {svc.name}
                  </p>
                  <p className="text-[11px] font-semibold text-foreground/60 mt-0.5">
                    {CATEGORY_LABELS[svc.category] ?? svc.category}
                  </p>
                </div>
                <span
                  className={[
                    'shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    isSelected
                      ? 'border-gold bg-gold'
                      : 'border-border bg-transparent',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {isSelected && <span className="w-2 h-2 rounded-full bg-background" />}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface FormatPickerBlockProps {
  service: StationService;
  selectedFormatId: string;
  onSelect: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}

function FormatPickerBlock({
  service,
  selectedFormatId,
  onSelect,
  t,
}: FormatPickerBlockProps) {
  /* Only the entries with a real vehicle_format_id can be booked through
   * the walk-in endpoint (others are catalogue placeholders). */
  const bookable = service.vehicle_entries.filter(
    (e) => e.is_active && e.vehicle_format_id,
  );

  if (bookable.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface/60 px-4 py-4 text-[13px] font-semibold text-foreground/70">
        {t('manual_queue_no_format')}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-foreground/65 mb-2">
        {t('manual_queue_format_label')}
        <span className="text-Hurryline-error ml-1">*</span>
      </label>
      <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {bookable.map((entry) => {
          const isSelected = entry.vehicle_format_id === selectedFormatId;
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(entry.vehicle_format_id!)}
              className={[
                'text-left rounded-xl border-[1.5px] p-3 transition-colors cursor-pointer',
                isSelected
                  ? 'border-gold bg-gold/10'
                  : 'border-border bg-surface hover:border-gold/40',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-black text-foreground leading-tight truncate">
                  {entry.vehicle_label}
                </span>
                <span
                  className={[
                    'shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                    isSelected ? 'border-gold bg-gold' : 'border-border',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-background" />}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[14px] font-black text-gold leading-none">
                  ${parseFloat(entry.price).toLocaleString()}
                </span>
                <span className="text-[10.5px] font-bold text-foreground/55">
                  · {entry.duration_min} min
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
