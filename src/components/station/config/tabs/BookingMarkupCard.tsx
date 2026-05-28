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

function ArrowIcon() {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
      <path
        d="M0 5h14M10 1l4 4-4 4"
        stroke="#C49A1E"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${checked ? 'bg-[#C49A1E]' : 'bg-[#D8D4C8] dark:bg-[#243020]'}`}
    >
      <span
        className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
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
      className={`rounded-2xl border p-6 shadow-sm transition-colors duration-150 ${
        enabled
          ? 'border-[#C49A1E]/30 bg-[#FFFDF5] dark:border-[#C49A1E]/20 dark:bg-[#1A1808]'
          : 'border-[#E8E4DC] bg-white dark:border-[#1A2A14] dark:bg-[#182214]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              enabled ? 'bg-[#C49A1E]/15 text-[#C49A1E]' : 'bg-[#F0EDE0] text-foreground/55 dark:bg-[#1A2A14] dark:text-[#9A9A8A]'
            }`}
            aria-hidden="true"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <h3 className="text-[14px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
              {t('surcharge_title')}
            </h3>
            <p className="mt-1 max-w-md text-[12px] leading-snug text-foreground/55 dark:text-[#9A9A8A]">
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

      {enabled && (
        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#9A9A8A]">
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

          <div
            className="flex items-center justify-between gap-3 rounded-xl border border-[#C49A1E]/20 bg-[#C49A1E]/5 px-5 py-3"
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-foreground/55 dark:text-[#9A9A8A]">
                {t('surcharge_preview_queue')}
              </span>
              <span className="font-mono text-[18px] font-black tabular-nums text-[#1A1A0A] dark:text-[#F0EDD4]">
                {previewQueue} $
              </span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <ArrowIcon />
              <span className="rounded-full bg-[#C49A1E]/15 px-2 py-0.5 font-mono text-[10px] font-black tabular-nums text-[#C49A1E]">
                +{safeMarkup.toFixed(2)} $
              </span>
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-foreground/55 dark:text-[#9A9A8A]">
                {t('surcharge_preview_online')}
              </span>
              <span className="font-mono text-[18px] font-black tabular-nums text-[#C49A1E]">
                {previewOnline} $
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
