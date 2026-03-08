'use client';

import { useTranslations } from 'next-intl';

export function PhoneMockup() {
  const t = useTranslations('landing');

  return (
    <div className="relative animate-float" style={{ animationDuration: '6s' }}>
      {/* Glow behind phone */}
      <div className="absolute -inset-8 bg-gold/10 rounded-full blur-3xl" />

      {/* Phone frame */}
      <div className="relative w-[280px] h-[560px] rounded-[40px] bg-[#0A0A14] p-2 shadow-2xl shadow-black/30">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#0A0A14] rounded-b-2xl z-20" />

        {/* Screen */}
        <div className="w-full h-full rounded-[32px] overflow-hidden bg-white dark:bg-[#1A1E16]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-8 pb-2">
            <span className="text-[11px] font-bold text-[#333] dark:text-white/80">
              9:41
            </span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-2.5 rounded-sm border border-[#333] dark:border-white/60 flex items-end p-[1px]">
                <div className="w-full h-[60%] rounded-[1px] bg-[#333] dark:bg-white/60" />
              </div>
            </div>
          </div>

          {/* App header */}
          <div className="px-4 pt-3 pb-4">
            <p className="text-[11px] font-bold text-gold tracking-wider uppercase">
              Slowtime
            </p>
            <p className="text-[16px] font-black text-[#0A0A14] dark:text-white mt-1 leading-tight">
              {t('step_1_title')}
            </p>
          </div>

          {/* Search bar mockup */}
          <div className="mx-4 mb-4 flex items-center gap-2 px-3 py-2.5 bg-[#F4F3EE] dark:bg-[#243020] rounded-xl">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#999"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span className="text-[12px] text-[#999]">Paris, France</span>
          </div>

          {/* Station card 1 */}
          <div className="mx-4 mb-3 rounded-xl border border-[#E8E8D8] dark:border-[#2C3828] bg-white dark:bg-[#1E2A1A] p-3 shadow-sm">
            <div className="flex gap-3">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center flex-shrink-0">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#af8408"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#0A0A14] dark:text-white truncate">
                  Clean Express
                </p>
                <p className="text-[11px] text-[#888] dark:text-[#999] mt-0.5">
                  Paris 11e &middot; 0.8 km
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[11px] text-gold">&#9733; 4.9</span>
                  <span className="text-[10px] text-[#AAA]">(312)</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-lavo-success/15 text-lavo-success font-bold">
                    3 dispo
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Station card 2 */}
          <div className="mx-4 mb-3 rounded-xl border border-[#E8E8D8] dark:border-[#2C3828] bg-white dark:bg-[#1E2A1A] p-3 shadow-sm">
            <div className="flex gap-3">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center flex-shrink-0">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#af8408"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#0A0A14] dark:text-white truncate">
                  Aqua Wash Pro
                </p>
                <p className="text-[11px] text-[#888] dark:text-[#999] mt-0.5">
                  Paris 15e &middot; 1.2 km
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[11px] text-gold">&#9733; 4.7</span>
                  <span className="text-[10px] text-[#AAA]">(187)</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-lavo-success/15 text-lavo-success font-bold">
                    5 dispo
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Floating confirmation toast */}
          <div className="mx-4 mt-2 rounded-xl bg-[#0A0A14] dark:bg-gold/10 p-3 animate-float-card">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-lavo-success/20 flex items-center justify-center flex-shrink-0">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#00C851"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-[12px] font-bold text-white leading-tight">
                  {t('card_confirmed')}
                </p>
                <p className="text-[10px] text-[#AAA]">{t('card_time')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
