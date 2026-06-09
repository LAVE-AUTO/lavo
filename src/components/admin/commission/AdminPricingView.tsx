'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminCommissionView } from './AdminCommissionView';
import { AdminSubscriptionPlansView } from './AdminSubscriptionPlansView';

type Tab = 'commission' | 'subscriptions';

/**
 * Tarification hub — two pricing models for stations: per-transaction commission
 * and subscription plans. Each station can later be set to one or the other.
 */
export function AdminPricingView() {
  const t = useTranslations('admin_commission');
  const [tab, setTab] = useState<Tab>('commission');

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'commission', label: t('tab_commission') },
    { id: 'subscriptions', label: t('tab_subscriptions') },
  ];

  return (
    <div className="flex min-h-full flex-col">
      {/* Header + tabs */}
      <div className="shrink-0 border-b border-separator bg-transparent px-6 py-5 dark:border-[#1A2A14] dark:bg-dark-bg">
        <h1 className="text-[22px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('pricing_title')}</h1>
        <p className="mt-1 text-[13px] text-foreground/55 dark:text-[#B0BFB1]">{t('pricing_subtitle')}</p>
        <div className="mt-4 inline-flex gap-1 rounded-xl bg-[#F0EDE6] p-1 dark:bg-[#0E1A0C]">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`rounded-lg px-4 py-2 text-[13px] font-bold transition-colors ${
                tab === id
                  ? 'bg-[#DDAF3B] text-[#001201] shadow-sm'
                  : 'text-foreground/55 hover:text-[#001201] dark:text-[#B0BFB1] dark:hover:text-[#FFF9EC]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'commission' ? (
          <AdminCommissionView embedded />
        ) : (
          <div className="h-full overflow-y-auto bg-[#FFF9EC] p-6 dark:bg-dark-bg">
            <AdminSubscriptionPlansView />
          </div>
        )}
      </div>
    </div>
  );
}
