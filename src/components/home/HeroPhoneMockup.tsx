'use client';

import { useTranslations } from 'next-intl';

export function HeroPhoneMockup() {
  const t = useTranslations('home.hero');

  return (
    <div className="relative">
      {/* Bubble 1 - top left */}
      <div
        className="absolute top-[-20px] left-[-64px] z-10 min-w-[160px] rounded-[10px] border border-[rgba(221,175,59,0.25)] bg-[#e8e2d4] dark:bg-[#111f0f] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] animate-float hidden lg:block"
        style={{ animationDelay: '0s' }}
      >
        <div className="font-dm-mono mb-1 text-[9px] uppercase tracking-[1px] text-[var(--foreground)] dark:text-[#B0BFB1]">
          {t('bubble_1_label')}
        </div>
        <div className="font-playfair text-[20px] font-bold leading-none text-[#DDAF3B]">
          {t('bubble_1_val')}
        </div>
        <div className="mt-1 text-[9px] text-[var(--foreground)] dark:text-[#B0BFB1]">{t('bubble_1_sub')}</div>
      </div>

      {/* Bubble 2 - bottom right */}
      <div
        className="absolute bottom-[120px] right-[-56px] z-10 min-w-[160px] rounded-[10px] border border-[rgba(221,175,59,0.25)] bg-[#e8e2d4] dark:bg-[#111f0f] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] animate-float hidden lg:block"
        style={{ animationDelay: '0.8s' }}
      >
        <div className="font-dm-mono mb-1 text-[9px] uppercase tracking-[1px] text-[var(--foreground)] dark:text-[#B0BFB1]">
          {t('bubble_2_label')}
        </div>
        <div className="font-playfair text-[20px] font-bold leading-none text-[#DDAF3B]">
          {t('bubble_2_val')}
        </div>
        <div className="mt-1 text-[9px] text-[var(--foreground)] dark:text-[#B0BFB1]">{t('bubble_2_sub')}</div>
      </div>

      {/* Phone frame */}
      <div className="relative w-[264px] h-[540px] rounded-[36px] border-2 border-[rgba(221,175,59,0.28)] bg-[#001201] dark:bg-[#111f0f] overflow-hidden shadow-[0_0_0_8px_rgba(221, 175, 59,0.05),0_40px_90px_rgba(0,0,0,0.6)] animate-float">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 h-5 w-[72px] rounded-b-[12px] bg-[#001201] dark:bg-[#001201]" />

        {/* Screen content */}
        <div className="flex h-full flex-col gap-2.5 px-3.5 pt-8 pb-3.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="font-playfair text-[17px] font-black tracking-[3px] text-[#DDAF3B]">
              Hurryline
            </span>
            <div className="h-[26px] w-[26px] rounded-full border border-[rgba(221,175,59,0.35)] bg-[#162218]" />
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2 rounded-[8px] border border-[rgba(221,175,59,0.2)] bg-[rgba(245,237,214,0.06)] px-3 py-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B0BFB1" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <span className="text-[10px] text-[#B0BFB1]">{t('phone_search')}</span>
          </div>

          {/* Station card 1 */}
          <PhoneStationCard
            name={t('station_1_name')}
            addr={t('station_1_addr')}
            rating={t('station_1_rating')}
            price={t('station_1_price')}
            open={t('open')}
            showBook
            bookLabel={t('book')}
          />

          {/* Station card 2 */}
          <PhoneStationCard
            name={t('station_2_name')}
            addr={t('station_2_addr')}
            rating={t('station_2_rating')}
            price={t('station_2_price')}
            open={t('open')}
            showBook={false}
            bookLabel={t('book')}
          />
        </div>
      </div>
    </div>
  );
}

interface PhoneStationCardProps {
  name: string;
  addr: string;
  rating: string;
  price: string;
  open: string;
  showBook: boolean;
  bookLabel: string;
}

function PhoneStationCard({ name, addr, rating, price, open, showBook, bookLabel }: PhoneStationCardProps) {
  return (
    <div className="rounded-[10px] bg-[#f5edd6] p-3">
      <div className="mb-1.5 flex items-start justify-between">
        <span className="text-[12px] font-bold text-[#3d2a10]">{name}</span>
        <span className="rounded-full border border-[#16a34a44] bg-[#22c55e20] px-1.5 py-0.5 text-[8px] font-bold text-[#16a34a]">
          {open}
        </span>
      </div>
      <div className="mb-0.5 flex items-center gap-1 text-[9px] text-[rgba(61,42,16,0.55)]">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {addr}
      </div>
      <div className="mb-1 text-[9px]">
        <span className="text-[#DDAF3B]">{'★'.repeat(5)}</span>
        <span className="ml-1 text-[rgba(61,42,16,0.55)]">{rating}</span>
      </div>
      <div className="font-rajdhani text-[14px] font-bold text-[#3d2a10]">{price}</div>
      {showBook && (
        <div className="mt-1.5 rounded-[6px] bg-[#DDAF3B] py-1.5 text-center text-[9px] font-bold uppercase tracking-[1px] text-[#001201]">
          {bookLabel}
        </div>
      )}
    </div>
  );
}
