'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ScrollReveal } from './ScrollReveal';

const SERVICE_FEATURES = [
  'service_feat_1',
  'service_feat_2',
  'service_feat_3',
] as const;

export function LandingService() {
  const t = useTranslations('landing');

  return (
    <section className="py-16 sm:py-28 landing-service-bg transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: visual */}
          <ScrollReveal>
            <div className="relative mb-8 sm:mb-0">
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&q=80"
                  alt=""
                  className="w-full h-[260px] sm:h-[400px] object-cover"
                  loading="lazy"
                />
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-5 right-3 sm:bottom-6 sm:right-6 rounded-xl bg-white dark:bg-surface border border-gold/20 px-4 py-3 shadow-lg animate-float-card">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-gold/15 flex items-center justify-center">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#DDAF3B"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-foreground leading-tight">
                      0 min
                    </p>
                    <p className="text-[11px] text-foreground/55 dark:text-[#999]">
                      {t('card_wait')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Right: text */}
          <ScrollReveal delay={0.15}>
            <div className="space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-Hurryline-success/10 border border-Hurryline-success/20">
                <span className="w-2 h-2 rounded-full bg-Hurryline-success" />
                <span className="text-[13px] font-bold text-Hurryline-success tracking-wide uppercase">
                  {t('service_badge')}
                </span>
              </div>

              <h2 className="text-[30px] sm:text-[40px] font-black text-foreground leading-tight">
                {t('service_title')}
              </h2>

              <p className="text-[17px] text-foreground/70 leading-relaxed">
                {t('service_desc')}
              </p>

              {/* Mini features */}
              <ul className="space-y-3 pt-2">
                {SERVICE_FEATURES.map((key) => (
                  <li
                    key={key}
                    className="flex items-center gap-3 text-[15px] text-[#333] dark:text-white/80"
                  >
                    <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#DDAF3B"
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

              <div className="pt-4">
                <Link
                  href="/stations"
                  className="btn-shine inline-flex items-center gap-2 px-7 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-bold text-dark-bg transition-colors shadow-lg shadow-gold/15"
                >
                  {t('service_cta')}
                  <svg
                    width="16"
                    height="16"
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
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
