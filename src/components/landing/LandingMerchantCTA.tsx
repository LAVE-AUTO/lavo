'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ScrollReveal } from './ScrollReveal';

const MERCHANT_FEATURES = [
  'merchant_feat_1',
  'merchant_feat_2',
  'merchant_feat_3',
] as const;

export function LandingMerchantCTA() {
  const t = useTranslations('landing');

  return (
    <section className="py-16 sm:py-28 bg-[#F4F3EE] dark:bg-surface/60 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <ScrollReveal>
          <div className="rounded-3xl bg-gradient-to-br from-[#0A0A14] to-[#1A1A2E] dark:from-dark-bg dark:to-[#1E2A1A] border border-[#1E1E2E] dark:border-border p-8 sm:p-14 lg:p-20 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gold/8 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-gold/5 rounded-full blur-3xl" />

            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
              {/* Text */}
              <div>
                <h2 className="text-[30px] sm:text-[40px] font-black text-white leading-tight">
                  {t('merchant_title')}
                </h2>
                <p className="mt-4 text-[17px] text-[#A0A0A0] leading-relaxed">
                  {t('merchant_subtitle')}
                </p>

                <ul className="mt-8 space-y-3">
                  {MERCHANT_FEATURES.map((key) => (
                    <li
                      key={key}
                      className="flex items-center gap-3 text-[15px] text-white/80"
                    >
                      <div className="w-6 h-6 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#af8408"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      {t(key)}
                    </li>
                  ))}
                </ul>

                <div className="mt-10">
                  <Link
                    href="/merchant"
                    className="btn-shine inline-flex items-center gap-2 px-8 py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[16px] font-bold text-dark-bg transition-colors shadow-lg shadow-gold/20"
                  >
                    {t('merchant_cta')}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Dashboard preview - desktop full */}
              <div className="hidden lg:block">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
                  {/* Header bar */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-3 h-3 rounded-full bg-red-400/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                    <div className="w-3 h-3 rounded-full bg-green-400/80" />
                    <span className="ml-3 text-[12px] text-white/40 font-mono">
                      dashboard.Hurryline.app
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: 'Aujourd\'hui', val: '24', sub: 'reservations' },
                      { label: 'Revenus', val: '\u20AC 1,280', sub: 'ce mois' },
                      { label: 'Taux', val: '96%', sub: 'satisfaction' },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-xl bg-white/5 border border-white/5 p-3"
                      >
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">
                          {s.label}
                        </p>
                        <p className="text-[20px] font-black text-white mt-1 leading-tight">
                          {s.val}
                        </p>
                        <p className="text-[10px] text-gold/70 mt-0.5">
                          {s.sub}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Mini chart */}
                  <div className="rounded-xl bg-white/5 border border-white/5 p-4">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider mb-3">
                      Activit&eacute; hebdomadaire
                    </p>
                    <div className="flex items-end gap-2 h-16">
                      {[40, 65, 50, 80, 70, 90, 75].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t bg-gradient-to-t from-gold/60 to-gold/30 transition-all"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dashboard preview - mobile compact */}
              <div className="lg:hidden mt-8">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                    <span className="ml-2 text-[11px] text-white/30 font-mono">
                      dashboard.Hurryline.app
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Reservations', val: '24' },
                      { label: 'Revenus', val: '\u20AC 1,280' },
                      { label: 'Satisfaction', val: '96%' },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-lg bg-white/5 border border-white/5 p-2.5 text-center"
                      >
                        <p className="text-[16px] sm:text-[18px] font-black text-white leading-tight">
                          {s.val}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-gold/70 mt-0.5 uppercase tracking-wider">
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
