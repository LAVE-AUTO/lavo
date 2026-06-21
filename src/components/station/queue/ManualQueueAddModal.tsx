'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface LookupResponse {
  data?: {
    matched: boolean;
    first_name?: string | null;
    last_name?: string | null;
  };
}

interface ManualQueueAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the newly created entry id so the parent can refresh. */
  onSuccess: (entryId: string) => void;
}

/* Service categories localised the same way as /stations/[id] and the
 * client cards so the merchant sees consistent wording. */
const CATEGORY_KEYS: Record<string, string> = {
  hand_wash:    'cat_hand_wash',
  automatic:    'cat_automatic',
  self_service: 'cat_self_service',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Walk-in entry creation for the station merchant.
 *
 * The flow is:
 *   1. Client identity (email REQUIRED, name optional). The email is
 *      probed against the platform — if it belongs to a registered
 *      client account, the entry is tied to that user (they will see
 *      it in /me/entries + /client/history and get an in-app notif).
 *      Unregistered emails get the off-platform receipt email on
 *      completion, with a CTA to create an account.
 *   2. Pick a station service (Lavage Premium, Forfait Complet…).
 *   3. Pick a vehicle format scoped to the service. When the service
 *      has no configured format we surface a notice but still allow
 *      submission — the entry is created without a format and the
 *      merchant collects payment off-platform.
 *
 * On confirm we POST /station/entries with the picked identity +
 * service + format so the entry is snapshooted correctly.
 */
export function ManualQueueAddModal({
  isOpen,
  onClose,
  onSuccess,
}: ManualQueueAddModalProps) {
  const t = useTranslations('station_dashboard');

  /* Client step ---------------------------------------------------- */
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'matched' | 'unmatched' | 'invalid'>('idle');
  const [matchedFirstName, setMatchedFirstName] = useState<string | null>(null);
  const [matchedLastName, setMatchedLastName] = useState<string | null>(null);
  const lookupReqIdRef = useRef(0);

  /* Service / format step ----------------------------------------- */
  const [services, setServices] = useState<StationService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [formatId, setFormatId] = useState('');

  /* Submit state -------------------------------------------------- */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* Fetch services + reset every time the modal opens / closes. */
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
      const envelope = data as ServicesEnvelope | { items?: StationService[] } | null;
      const rawItems =
        (envelope && typeof envelope === 'object' && 'data' in envelope
          ? envelope.data?.items
          : (envelope as { items?: StationService[] } | null)?.items) ?? [];
      const usable = rawItems.filter(
        (s) => s && s.is_active,
      );
      setServices(usable);
      setServicesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setEmail('');
    setName('');
    setLookupStatus('idle');
    setMatchedFirstName(null);
    setMatchedLastName(null);
    setServiceId('');
    setFormatId('');
    setSubmitError(null);
    setIsSubmitting(false);
  }, [isOpen]);

  /* Debounced email lookup: only fires when the email passes a basic
   * regex so we do not spam the endpoint while the user types. */
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setLookupStatus('idle');
      setMatchedFirstName(null);
      setMatchedLastName(null);
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setLookupStatus('invalid');
      setMatchedFirstName(null);
      setMatchedLastName(null);
      return;
    }
    lookupReqIdRef.current += 1;
    const reqId = lookupReqIdRef.current;
    setLookupStatus('loading');
    const timer = window.setTimeout(async () => {
      const [ok, data] = await getFromApi<LookupResponse>(
        `/station/clients/lookup?email=${encodeURIComponent(trimmed)}`
      );
      if (reqId !== lookupReqIdRef.current) return;
      if (!ok) {
        setLookupStatus('idle');
        return;
      }
      const result = (data as LookupResponse)?.data;
      if (result?.matched) {
        setLookupStatus('matched');
        setMatchedFirstName(result.first_name ?? null);
        setMatchedLastName(result.last_name ?? null);
      } else {
        setLookupStatus('unmatched');
        setMatchedFirstName(null);
        setMatchedLastName(null);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [email]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  const bookableEntries = useMemo(
    () =>
      selectedService?.vehicle_entries.filter(
        (e) => e.is_active && e.vehicle_format_id,
      ) ?? [],
    [selectedService],
  );

  /* Auto-select the first active entry when a service is picked,
   * but only when the service actually exposes one — otherwise clear
   * the format selection so the merchant can still proceed. */
  useEffect(() => {
    if (!selectedService) {
      setFormatId('');
      return;
    }
    const first = bookableEntries[0];
    setFormatId(first?.vehicle_format_id ?? '');
  }, [selectedService, bookableEntries]);

  const trimmedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(trimmedEmail);
  const hasService = Boolean(serviceId);
  const hasFormat = Boolean(formatId);
  const allowsNoFormat = selectedService !== null && bookableEntries.length === 0;
  const canSubmit =
    emailValid && hasService && (hasFormat || allowsNoFormat) && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const payload: Record<string, string> = {
      service_id: serviceId,
      client_email: trimmedEmail,
    };
    if (name.trim()) payload.client_name = name.trim();
    if (formatId) payload.vehicle_format_id = formatId;
    const [ok, data] = await postWithApi('/station/entries', payload);
    if (!ok) {
      setIsSubmitting(false);
      if (process.env.NODE_ENV !== 'production') {
        console.error('[ManualQueueAddModal] POST /station/entries failed', data);
      }
      const errorBody = data as { code?: string; message?: string; _dev?: string } | null;
      const code = errorBody?.code;
      /* Dev-mode: surface the server's _dev hint so 'column X does not
       * exist' shows up directly in the modal instead of a generic
       * 'try again' message. */
      const devHint =
        process.env.NODE_ENV !== 'production' && errorBody?._dev
          ? errorBody._dev
          : null;
      setSubmitError(
        devHint
          ? `${t('manual_queue_error_unavailable')} — ${devHint}`
          : code === 'VALIDATION_FAILED'
            ? t('manual_queue_error_format')
            : t('manual_queue_error_unavailable'),
      );
      return;
    }
    const entryId = (data as { data?: { id?: string } } | null)?.data?.id;
    setIsSubmitting(false);
    onSuccess(entryId ?? '');
    onClose();
  }, [canSubmit, formatId, name, onClose, onSuccess, serviceId, t, trimmedEmail]);

  return (
    <Modal open={isOpen} onClose={onClose} title={t('manual_queue_title')} size="2xl">
      <div className="space-y-5 px-5 py-5">
        <p className="text-[13px] leading-relaxed text-foreground/65">
          {t('manual_queue_subtitle')}
        </p>

        {/* Step 1 — Client identity */}
        <ClientStep
          email={email}
          onEmailChange={setEmail}
          name={name}
          onNameChange={setName}
          lookupStatus={lookupStatus}
          matchedFirstName={matchedFirstName}
          matchedLastName={matchedLastName}
          t={t}
        />

        {/* Step 2 — Service */}
        <ServicePickerBlock
          services={services}
          servicesLoading={servicesLoading}
          servicesError={servicesError}
          selectedServiceId={serviceId}
          onSelect={setServiceId}
          t={t}
        />

        {/* Step 3 — Vehicle format (optional when the service has none) */}
        {selectedService && (
          <FormatPickerBlock
            service={selectedService}
            bookable={bookableEntries}
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
            className="btn-shine flex-1 rounded-xl bg-gold px-4 py-2.5 text-[14px] font-bold text-dark transition-all hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
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

interface ClientStepProps {
  email: string;
  onEmailChange: (v: string) => void;
  name: string;
  onNameChange: (v: string) => void;
  lookupStatus: 'idle' | 'loading' | 'matched' | 'unmatched' | 'invalid';
  matchedFirstName: string | null;
  matchedLastName: string | null;
  t: ReturnType<typeof useTranslations>;
}

function ClientStep({
  email,
  onEmailChange,
  name,
  onNameChange,
  lookupStatus,
  matchedFirstName,
  matchedLastName,
  t,
}: ClientStepProps) {
  const matchedDisplay = [matchedFirstName, matchedLastName].filter(Boolean).join(' ').trim();
  const showHint = lookupStatus === 'matched' || lookupStatus === 'unmatched' || lookupStatus === 'loading';

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface/60 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground/65">
        {t('manual_queue_client_label')}
      </p>

      {/* Email — required */}
      <div>
        <label htmlFor="manual-queue-email" className="block text-[12px] font-semibold text-foreground/70 mb-1.5">
          {t('manual_queue_email_label')}
          <span className="text-Hurryline-error ml-1">*</span>
        </label>
        <input
          id="manual-queue-email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder={t('manual_queue_email_placeholder')}
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] font-medium text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition-colors"
        />
      </div>

      {/* Name — optional */}
      <div>
        <label htmlFor="manual-queue-name" className="block text-[12px] font-semibold text-foreground/70 mb-1.5">
          {t('manual_queue_name_label')}
          <span className="text-foreground/45 ml-1.5 text-[11px] font-normal">
            {t('manual_queue_name_optional')}
          </span>
        </label>
        <input
          id="manual-queue-name"
          type="text"
          autoComplete="off"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('manual_queue_name_placeholder')}
          maxLength={200}
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] font-medium text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition-colors"
        />
      </div>

      {/* Lookup hint — premium glow that surfaces the match status */}
      {showHint && (
        <div
          role="status"
          aria-live="polite"
          className={[
            'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-colors',
            lookupStatus === 'matched'
              ? 'bg-gold/10 border border-gold/30 text-foreground'
              : lookupStatus === 'unmatched'
                ? 'bg-foreground/5 border border-border text-foreground/70'
                : 'bg-foreground/5 border border-border text-foreground/55',
          ].join(' ')}
        >
          {lookupStatus === 'loading' ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              {t('manual_queue_lookup_loading')}
            </>
          ) : lookupStatus === 'matched' ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>
                {t('manual_queue_lookup_matched')}{' '}
                <strong className="text-gold">
                  {matchedDisplay || t('manual_queue_lookup_matched_no_name')}
                </strong>
              </span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {t('manual_queue_lookup_unmatched')}
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
                    {CATEGORY_KEYS[svc.category] ? t(CATEGORY_KEYS[svc.category]) : svc.category}
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
  bookable: ServiceVehicleEntry[];
  selectedFormatId: string;
  onSelect: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}

function FormatPickerBlock({
  bookable,
  selectedFormatId,
  onSelect,
  t,
}: FormatPickerBlockProps) {
  /* No format on this service — surface a friendly notice but allow
   * the merchant to keep going. The walk-in will be queued without a
   * vehicle format and the off-platform payment is the merchant's
   * responsibility. */
  if (bookable.length === 0) {
    return (
      <div
        role="note"
        className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3.5 text-[13px] font-semibold text-foreground"
      >
        <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.15em] text-gold">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {t('manual_queue_no_format_title')}
        </p>
        <p className="mt-1.5 text-[12.5px] font-normal text-foreground/75 leading-relaxed">
          {t('manual_queue_no_format')}
        </p>
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
