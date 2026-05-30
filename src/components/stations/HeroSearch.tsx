'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

/**
 * Interactive search bar embedded in the hero section.
 * Navigates to /stations?q=<value> and scrolls to #stations-list.
 */
export function HeroSearch() {
  const t      = useTranslations('stations');
  const router = useRouter();
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (q) {
      router.push(`/stations?q=${encodeURIComponent(q)}`);
    }
    setTimeout(() => {
      document.getElementById('stations-list')?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 px-4 py-3.5 mb-7 bg-white/[0.07] hover:bg-white/10 border border-white/13 hover:border-gold/40 rounded-2xl transition-all backdrop-blur-sm group animate-fade-in-up animation-delay-300"
    >
      <div className="w-9 h-9 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('hero_search_placeholder')}
        className="text-white/75 text-[15px] flex-1 bg-transparent outline-none placeholder:text-white/35 min-w-0"
        aria-label={t('hero_search_placeholder')}
      />

      <button
        type="submit"
        className="px-4 py-2 bg-gold hover:bg-gold-hover rounded-xl text-[13px] font-bold text-dark-bg transition-colors shrink-0 cursor-pointer"
      >
        {t('hero_search_cta')}
      </button>
    </form>
  );
}
