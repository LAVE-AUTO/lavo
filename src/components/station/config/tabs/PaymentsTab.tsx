'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, postWithApi } from '@/services';

interface StripeStatus {
  connected: false;
}

interface StripeStatusConnected {
  connected: true;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
}

type Status = StripeStatus | StripeStatusConnected;

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function StripeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="#635BFF" />
      <path d="M13.2 10.4c0-.96.8-1.33 2.13-1.33 1.87 0 3.74.53 5.07 1.6V6.27A14.13 14.13 0 0 0 15.33 5.6C11.47 5.6 9 7.6 9 10.67c0 4.8 6.8 4 6.8 6.13 0 1.07-.93 1.47-2.27 1.47-2 0-4-.8-5.53-2v4.53c1.6.8 3.2 1.07 4.93 1.07C16.8 21.87 19.4 20 19.4 16.8 19.4 11.73 13.2 12.8 13.2 10.4z" fill="white" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function StatusRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#F0EDE4] last:border-0 dark:border-[#1A2A14]">
      <span className="text-[13px] text-[#444] dark:text-[#C0C0B0]">{label}</span>
      <span
        className={`flex items-center gap-1 text-[12px] font-bold ${
          enabled ? 'text-[#2ECC71]' : 'text-[#AAAAAA] dark:text-[#4A4A3A]'
        }`}
      >
        {enabled ? <CheckIcon /> : <WarningIcon />}
        {enabled ? '✓' : '-'}
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[#E8E4DC] bg-white p-6 dark:border-[#1A2A14] dark:bg-[#182214]">
      <div className="h-4 w-32 rounded bg-[#E8E4DC] dark:bg-[#001A05] mb-4" />
      <div className="h-10 w-full rounded-xl bg-[#F0EDE4] dark:bg-[#001201]" />
    </div>
  );
}

interface Props {
  locked: boolean;
}

export function PaymentsTab({ locked }: Props) {
  const t = useTranslations('station_config');

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    const [ok, data] = await getFromApi('/station/stripe/status');
    if (ok) {
      setStatus((data as { data: Status }).data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleConnect() {
    setActionLoading(true);
    const [ok, data] = await postWithApi('/station/stripe/onboarding', {});
    setActionLoading(false);
    if (ok) {
      const url = (data as { data: { url: string } }).data.url;
      window.location.href = url;
    }
  }

  if (loading) return <Skeleton />;

  const isConnected = status?.connected === true;
  const isActive = isConnected && (status as StripeStatusConnected).charges_enabled;
  const isPending = isConnected && !(status as StripeStatusConnected).charges_enabled;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#DDAF3B]">
            {t('payments_stripe_title')}
          </h3>
          {isActive && (
            <span className="flex items-center gap-1 rounded-full bg-[#E6F9EF] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2ECC71] dark:bg-[#0A2010] dark:text-[#2ECC71]">
              <CheckIcon />
              {t('payments_stripe_active_badge')}
            </span>
          )}
          {isPending && (
            <span className="flex items-center gap-1 rounded-full bg-[#FFF8E6] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#DDAF3B] dark:bg-[#1A1200] dark:text-[#DDAF3B]">
              <WarningIcon />
              {t('payments_stripe_pending_badge')}
            </span>
          )}
        </div>

        {!isConnected && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-[#9A9A8A]">
              {t('payments_stripe_not_connected_desc')}
            </p>
            <button
              type="button"
              disabled={actionLoading || locked}
              onClick={handleConnect}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#635BFF] px-5 py-3 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <StripeIcon />
              {actionLoading ? t('payments_stripe_connecting') : t('payments_stripe_connect_btn')}
            </button>
          </div>
        )}

        {isPending && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-[#9A9A8A]">
              {t('payments_stripe_pending_desc')}
            </p>
            <button
              type="button"
              disabled={actionLoading || locked}
              onClick={handleConnect}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#DDAF3B] px-5 py-3 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {actionLoading ? t('payments_stripe_connecting') : t('payments_stripe_complete_btn')}
            </button>
          </div>
        )}

        {isActive && (
          <div className="flex flex-col gap-3">
            <StatusRow
              label={t('payments_stripe_charges')}
              enabled={(status as StripeStatusConnected).charges_enabled}
            />
            <StatusRow
              label={t('payments_stripe_payouts')}
              enabled={(status as StripeStatusConnected).payouts_enabled}
            />
            <div className="pt-1">
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#635BFF] hover:underline"
              >
                {t('payments_stripe_dashboard_link')}
                <ExternalLinkIcon />
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
