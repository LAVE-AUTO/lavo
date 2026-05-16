'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[18px] sm:text-[20px] font-black text-[#1a1a1a] dark:text-white flex items-center gap-2.5">
        <span className="w-1.5 h-6 bg-gold rounded-full shrink-0" />
        {title}
      </h2>
      <div className="pl-4 text-[14px] sm:text-[15px] text-[#555] dark:text-[#A0A090] leading-[1.8] space-y-2">
        {children}
      </div>
    </section>
  );
}

export function CancellationPolicyContent() {
  const t = useTranslations('cancel_policy');

  const tiers = [
    { delay: t('tier1_delay'), refund: t('tier1_refund'), color: 'text-Hurryline-success' },
    { delay: t('tier2_delay'), refund: t('tier2_refund'), color: 'text-gold' },
    { delay: t('tier3_delay'), refund: t('tier3_refund'), color: 'text-Hurryline-error' },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 pt-12 pb-20">
      <div className="max-w-3xl">

        {/* Header */}
        <p className="text-[12px] font-bold tracking-[3px] uppercase text-[#c8980a] mb-3">{t('eyebrow')}</p>
        <h1 className="font-playfair text-[36px] sm:text-[44px] font-black text-[#1a1a1a] dark:text-white leading-tight mb-3">
          {t('title')}
        </h1>
        <p className="text-[14px] text-[#888] dark:text-[#666] mb-10">{t('updated')}</p>

        <div className="space-y-10">

          <PolicySection title={t('s1_title')}>
            <p>{t('s1_p1')}</p>
          </PolicySection>

          {/* Refund table */}
          <PolicySection title={t('s2_title')}>
            <p className="mb-4">{t('s2_intro')}</p>
            <div className="rounded-xl border border-[rgba(200,152,10,0.15)] overflow-hidden">
              <div className="grid grid-cols-2 bg-[rgba(200,152,10,0.07)] px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-[#888] dark:text-[#666]">
                <span>{t('table_delay')}</span>
                <span>{t('table_refund')}</span>
              </div>
              {tiers.map((tier, i) => (
                <div key={i} className="grid grid-cols-2 px-4 py-3.5 border-t border-[rgba(200,152,10,0.1)] text-[14px]">
                  <span className="text-[#1a1a1a] dark:text-white font-semibold">{tier.delay}</span>
                  <span className={`font-bold ${tier.color}`}>{tier.refund}</span>
                </div>
              ))}
            </div>
          </PolicySection>

          <PolicySection title={t('s3_title')}>
            <p>{t('s3_p1')}</p>
            <p>{t('s3_p2')}</p>
          </PolicySection>

          <PolicySection title={t('s4_title')}>
            <p>{t('s4_p1')}</p>
          </PolicySection>

          <PolicySection title={t('s5_title')}>
            <p>{t('s5_p1')}</p>
          </PolicySection>

          {/* Contact CTA */}
          <div className="pt-4 border-t border-[rgba(200,152,10,0.15)] flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <p className="text-[14px] text-[#555] dark:text-[#A0A090]">{t('questions')}</p>
            <Link href="/nous-contacter" className="shrink-0 px-5 py-2.5 bg-gold hover:bg-gold-hover text-dark-bg text-[13px] font-bold rounded-xl transition-colors">
              {t('contact_btn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
