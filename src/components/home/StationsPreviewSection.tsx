'use client';

import { useTranslations } from 'next-intl';
import { RevealOnScroll } from './RevealOnScroll';

function StationRow({
  name, addr, rating, slots, price, status, openLabel, closedLabel, bookLabel, joinLabel, dimmed,
}: {
  name: string; addr: string; rating: string; slots: string; price?: string;
  status: 'open' | 'closed'; openLabel: string; closedLabel: string;
  bookLabel: string; joinLabel: string; dimmed?: boolean;
}) {
  return (
    <div className={`rounded-[12px] p-5 transition-all duration-300 hover:translate-x-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)] bg-[#e8e2d4] dark:bg-[#f5edd6] ${dimmed ? 'opacity-50' : ''}`}>
      <div className="mb-2.5 flex items-start justify-between">
        <span className="text-[15px] font-bold text-[#3d2a10]">{name}</span>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
          status === 'open'
            ? 'border border-[#16a34a44] bg-[#22c55e20] text-[#16a34a]'
            : 'border border-[rgba(61,42,16,0.15)] bg-[rgba(61,42,16,0.1)] text-[rgba(61,42,16,0.4)]'
        }`}>
          {status === 'open' ? openLabel : closedLabel}
        </span>
      </div>

      <div className="mb-1.5 flex items-center gap-1 text-[11px] text-[rgba(61,42,16,0.5)]">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        {addr}
      </div>

      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-[#DDAF3B]">
          {'★'.repeat(Math.floor(parseFloat(rating)))}
          {parseFloat(rating) % 1 !== 0 && '☆'}
          {' '}{rating}
        </span>
        <span className="text-[11px] text-[rgba(61,42,16,0.5)]">{slots}</span>
      </div>

      {price && (
        <div className="font-rajdhani text-[20px] font-bold text-[#4e3518]">{price}</div>
      )}

      {status === 'open' && (
        <div className="mt-2.5 flex gap-2">
          <span className="inline-block rounded-[4px] bg-[#DDAF3B] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.8px] text-[#001201]">
            {bookLabel}
          </span>
          <span className="inline-block rounded-[4px] border border-[rgba(61,42,16,0.2)] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.8px] text-[rgba(61,42,16,0.5)]">
            {joinLabel} →
          </span>
        </div>
      )}
    </div>
  );
}

export function StationsPreviewSection() {
  const t = useTranslations('home.stations_preview');

  const formats = [
    { type: t('format_1_type'), price: t('format_1_price'), dur: t('format_1_dur') },
    { type: t('format_2_type'), price: t('format_2_price'), dur: t('format_2_dur') },
    { type: t('format_3_type'), price: t('format_3_price'), dur: t('format_3_dur') },
  ];

  return (
    <section className="px-6 py-16 lg:px-16 lg:py-20" id="stations">
      <div className="mx-auto max-w-[1280px]">
        <RevealOnScroll>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-[72px] items-center">
            {/* Left: text + pricing */}
            <div>
              <div className="font-dm-mono mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[3px] text-[#DDAF3B]">
                {t('tag')}
                <span className="h-px w-9 bg-[#DDAF3B] opacity-50" />
              </div>
              <h2 className="font-playfair mb-5 text-[clamp(34px,3.8vw,52px)] font-bold leading-[1.1] text-[#001201] dark:text-[#FFEECA]">
                {t('title')}<br />
                <em className="italic text-[#DDAF3B]">{t('title_accent')}</em>
              </h2>
              <p className="mb-7 text-[16px] leading-[1.75] text-[var(--foreground)] dark:text-[#B0BFB1]">
                {t('desc')}
              </p>

              {/* Pricing card */}
              <div className="rounded-[12px] border border-[rgba(221,175,59,0.15)] bg-[#1a1a0f] dark:bg-[#162218] p-6">
                <div className="font-dm-mono mb-3.5 text-[10px] uppercase tracking-[2px] text-[#DDAF3B]">
                  {t('pricing_label')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {formats.map((fmt) => (
                    <div key={fmt.type} className="rounded-[8px] bg-[#3d2a10] px-2 py-3 text-center">
                      <div className="mb-1 text-[8px] uppercase tracking-[1.5px] text-[rgba(245,237,214,0.4)]">
                        {fmt.type}
                      </div>
                      <div className="font-rajdhani text-[22px] font-bold text-[#DDAF3B]">{fmt.price}</div>
                      <div className="mt-0.5 text-[9px] text-[rgba(245,237,214,0.35)]">{fmt.dur}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: station list */}
            <div className="flex flex-col gap-3.5">
              <StationRow
                name={t('s1_name')} addr={t('s1_addr')} rating={t('s1_rating')}
                slots={t('s1_slots')} price={t('s1_price')} status="open"
                openLabel={t('open')} closedLabel={t('closed')}
                bookLabel={t('book')} joinLabel={t('join')}
              />
              <StationRow
                name={t('s2_name')} addr={t('s2_addr')} rating={t('s2_rating')}
                slots={t('s2_slots')} price={t('s2_price')} status="open"
                openLabel={t('open')} closedLabel={t('closed')}
                bookLabel={t('book')} joinLabel={t('join')}
              />
              <StationRow
                name={t('s3_name')} addr={t('s3_addr')} rating={t('s3_rating')}
                slots={t('s3_slots')} status="closed"
                openLabel={t('open')} closedLabel={t('closed')}
                bookLabel={t('book')} joinLabel={t('join')}
                dimmed
              />
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
