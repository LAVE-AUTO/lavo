'use client';

import { useTranslations } from 'next-intl';
import { NumberStepper } from '../NumberStepper';

interface Props {
  enabled: boolean;
  amount: string;
  onEnabledChange: (next: boolean) => void;
  onAmountChange: (next: string) => void;
  disabled?: boolean;
}

const PREVIEW_BASE_PRICE = 25;

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${checked ? 'bg-[#DDAF3B] shadow-[0_0_12px_rgba(221,175,59,0.5)]' : 'bg-[#C8C4B4] dark:bg-[#2A3A20]'}`}
    >
      <span
        className={`absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? 'translate-x-[26px]' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function BookingMarkupCard({
  enabled,
  amount,
  onEnabledChange,
  onAmountChange,
  disabled = false,
}: Props) {
  const t = useTranslations('station_config');

  const numeric = Number(amount);
  const safeMarkup = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  const previewQueue = PREVIEW_BASE_PRICE.toFixed(2);
  const previewOnline = (PREVIEW_BASE_PRICE + safeMarkup).toFixed(2);

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
        enabled
          ? 'border-[#DDAF3B] bg-gradient-to-br from-[#FFF8E1] to-[#FFF0BA] shadow-[0_4px_28px_rgba(221,175,59,0.30)] dark:from-[#2A1E08] dark:to-[#1A1200] dark:shadow-[0_4px_28px_rgba(221,175,59,0.20)]'
          : 'border-[#DDAF3B]/70 bg-gradient-to-br from-[#FFFBF0] to-[#FFF5D0] shadow-[0_4px_20px_rgba(221,175,59,0.18)] dark:from-[#1E1A08] dark:to-[#161208] dark:border-[#DDAF3B]/40 dark:shadow-[0_4px_20px_rgba(221,175,59,0.12)]'
      }`}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#DDAF3B] via-[#F5C842] to-[#DDAF3B]" aria-hidden="true" />

      {/* Subtle diagonal shine overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.02]"
        aria-hidden="true"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #DDAF3B 0px, #DDAF3B 1px, transparent 1px, transparent 12px)',
        }}
      />

      <div className="relative px-4 py-4 sm:px-6 sm:py-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DDAF3B] text-[#001201] shadow-[0_2px_8px_rgba(221,175,59,0.40)]"
              aria-hidden="true"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>

            {/* Title + badge + hint */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">
                  {t('surcharge_title')}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#DDAF3B] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#001201]">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span className="mt-0.5">Impact revenus</span>
                </span>
              </div>
              <p className="mt-1 max-w-md text-[12px] leading-snug text-[#4A4030] dark:text-[#B0BFB1]">
                {t('surcharge_hint')}
              </p>
            </div>
          </div>

          <ToggleSwitch
            checked={enabled}
            onChange={onEnabledChange}
            disabled={disabled}
            label={t('surcharge_toggle_aria')}
          />
        </div>

        {/* Expanded content when enabled */}
        {enabled && (
          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
            {/* Amount input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#7A6830] dark:text-[#B0BFB1]">
                {t('surcharge_amount_label')}
              </label>
              <NumberStepper
                value={amount}
                onChange={onAmountChange}
                min={0}
                step={0.5}
                unit="$"
                disabled={disabled}
                ariaLabel={t('surcharge_amount_label')}
              />
            </div>

            {/* Live preview */}
            <div
              className="flex items-center justify-between gap-3 rounded-xl border border-[#DDAF3B]/40 bg-white/60 px-5 py-3.5 dark:bg-black/20"
              aria-live="polite"
            >
              {/* Walk-in price */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#7A6830] dark:text-[#B0BFB1]">
                  {t('surcharge_preview_queue')}
                </span>
                <span className="font-mono text-[19px] font-black tabular-nums text-[#001201] dark:text-[#FFF9EC]">
                  {previewQueue} $
                </span>
              </div>

              {/* Arrow + delta */}
              <div className="flex flex-col items-center gap-1">
                <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
                  <path d="M0 5h16M12 1l4 4-4 4" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="rounded-full bg-[#DDAF3B] px-2.5 py-0.5 font-mono text-[10px] font-black tabular-nums text-[#001201]">
                  +{safeMarkup.toFixed(2)} $
                </span>
              </div>

              {/* Online price */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#7A6830] dark:text-[#B0BFB1]">
                  {t('surcharge_preview_online')}
                </span>
                <span className="font-mono text-[19px] font-black tabular-nums text-[#DDAF3B]">
                  {previewOnline} $
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Subtle "off" state hint when disabled */}
        {!enabled && (
          <p className="mt-3 text-[11px] font-semibold text-[#A09060] dark:text-[#7A6A40]">
            {t('surcharge_off_hint') || 'Activez pour facturer un supplément sur les réservations en ligne.'}
          </p>
        )}
      </div>
    </section>
  );
}
