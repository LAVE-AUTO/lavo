'use client';

import { useState } from 'react';
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
      <div className="relative w-[264px] h-[540px] rounded-[36px] border-2 border-[rgba(221,175,59,0.28)] bg-[#001201] dark:bg-[#111f0f] overflow-hidden shadow-[0_0_0_8px_rgba(221,175,59,0.05),0_40px_90px_rgba(0,0,0,0.6)] animate-float">
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
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <span className="text-[10px] text-[#B0BFB1]">{t('phone_search')}</span>
          </div>

          {/* Station card 1 */}
          <PhoneStationCard
            name={t('station_1_name')}
            rating={t('station_1_rating')}
            reviews={t('station_1_reviews')}
            price={t('station_1_price')}
            distance={t('station_1_distance')}
            wait={t('station_1_wait')}
            tags={['Pack Premium', 'Lavage Complet']}
            showBook
            bookLabel={t('book')}
            imgSrc="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=264&h=80&fit=crop&auto=format&q=80"
          />

          {/* Station card 2 */}
          <PhoneStationCard
            name={t('station_2_name')}
            rating={t('station_2_rating')}
            reviews={t('station_2_reviews')}
            price={t('station_2_price')}
            distance={t('station_2_distance')}
            wait={t('station_2_wait')}
            tags={['Mini-Lavage']}
            showBook={false}
            bookLabel={t('book')}
            imgSrc="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=264&h=80&fit=crop&auto=format&q=80"
          />
        </div>
      </div>
    </div>
  );
}

interface PhoneStationCardProps {
  name: string;
  rating: string;
  reviews: string;
  price: string;
  distance: string;
  wait: string;
  tags: string[];
  showBook: boolean;
  bookLabel: string;
  imgSrc: string;
}

function PhoneStationCard({ name, rating, reviews, price, distance, wait, tags, showBook, bookLabel, imgSrc }: PhoneStationCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    /* Force light-mode colors — card lives inside a dark phone frame and must always contrast against it */
    <article className="flex flex-col bg-surface rounded-[14px] overflow-hidden border border-border group hover:border-gold/30 transition-all duration-300">
      {/* Photo zone — mirrors StationCard image area */}
      <div className="relative h-[80px] bg-[#D0D0C0] flex items-center justify-center overflow-hidden">
        {!imgFailed ? (
          <img
            src={imgSrc}
            alt={name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
          />
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l2-7h14l2 7" />
            <path d="M5 17v2h2v-2M17 17v2h2v-2" />
            <path d="M8 10V7a1 1 0 011-1h6a1 1 0 011 1v3" />
            <circle cx="7.5" cy="17" r="1.5" fill="#9A9A8A" />
            <circle cx="16.5" cy="17" r="1.5" fill="#9A9A8A" />
          </svg>
        )}

        {/* Name overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent flex items-end px-2.5 pb-1.5 pointer-events-none">
          <span className="text-white text-[10px] font-bold leading-tight truncate drop-shadow">
            {name}
          </span>
        </div>
      </div>

      {/* Card body — mirrors StationCard's p-4 section, always light */}
      <div className="px-2.5 pt-2 pb-2 flex flex-col gap-1.5">
        {/* Name + price */}
        <div className="flex items-start justify-between gap-1">
          <span className="text-[11px] font-bold text-foreground leading-tight line-clamp-1">{name}</span>
          <span className="text-[10px] font-bold text-[#DDAF3B] shrink-0">{price}</span>
        </div>

        {/* Rating + review count */}
        <div className="flex items-center gap-1">
          <span className="text-[#DDAF3B] text-[11px]">&#9733;</span>
          <span className="text-[9px] font-semibold text-foreground">{rating}</span>
          <span className="text-[9px] text-[#DDAF3B]">{reviews}</span>
        </div>

        {/* Stats grid: distance | wait */}
        <div className="grid grid-cols-2 text-center border-t border-border pt-1.5">
          <div className="border-r border-border pr-1">
            <div className="text-[11px] font-black text-foreground leading-none">{distance}</div>
            <div className="text-[8px] text-foreground/70 mt-0.5">Distance</div>
          </div>
          <div className="pl-1">
            <div className="text-[11px] font-black text-foreground leading-none">{wait}</div>
            <div className="text-[8px] text-foreground/70 mt-0.5">Attente</div>
          </div>
        </div>

        {/* Forfait tag chips */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-surface text-[#000000] border border-border"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        {showBook && (
          <div className="rounded-[6px] bg-[#DDAF3B] py-1.5 text-center text-[9px] font-bold uppercase tracking-[1px] text-[#001201]">
            {bookLabel}
          </div>
        )}
      </div>
    </article>
  );
}
