import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Hero banner at the top of the public stations list page.
 * Server component — no client JS needed.
 */
export async function StationsHero() {
  const t  = await getTranslations('stations');
  const tn = await getTranslations('nav');

  return (
    <div
      className="relative overflow-hidden"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at 60% 40%, rgba(196,154,30,0.18) 0%, transparent 60%),
          linear-gradient(160deg, rgba(26,33,22,0.97) 0%, rgba(36,48,32,0.95) 50%, rgba(26,33,22,0.97) 100%),
          url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80')
        `,
        backgroundSize: 'auto, auto, cover',
        backgroundPosition: 'center, center, center',
      }}
    >
      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23C49A1E' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Gold shimmer bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent animate-gold-shimmer" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="flex items-center gap-12">
          {/* Left: text content */}
          <div className="flex-1 max-w-xl">
            {/* Label */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/30 bg-gold/10 mb-5 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-gold-shimmer" />
              <span className="text-[14px] font-bold text-gold uppercase tracking-widest">
                Slowtime Network
              </span>
            </div>

            {/* Title */}
            <h1 className="text-[44px] sm:text-[60px] font-[900] text-white leading-tight mb-4 animate-fade-in-up animation-delay-100">
              {t('page_title')}
            </h1>

            {/* Subtitle */}
            <p className="text-[20px] sm:text-[22px] text-lavo-muted leading-[1.7] mb-8 animate-fade-in-up animation-delay-200">
              {t('page_subtitle')}
            </p>

            {/* CTA */}
            <div className="flex flex-wrap gap-3 animate-fade-in-up animation-delay-300">
              <Link
                href="#stations-list"
                className="btn-shine inline-flex items-center gap-2 px-8 py-4 bg-gold hover:bg-gold-hover rounded-[12px] text-[18px] font-bold text-[#1A2116] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {t('filter_available')}
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 hover:border-gold/50 rounded-[12px] text-[18px] font-bold text-white transition-colors"
              >
                {tn('register')}
              </Link>
            </div>
          </div>

          {/* Right: floating stat badges (desktop only) */}
          <div className="hidden md:flex flex-col gap-4 shrink-0">
            <div className="bg-[#1E2A1A]/90 border border-[#3A4A36] rounded-xl px-4 py-3 animate-fade-in-up animation-delay-100">
              <div className="text-[24px] font-black text-gold leading-none">150+</div>
              <div className="text-[14px] text-[#9A9A8A] mt-1">Stations partenaires</div>
            </div>
            <div className="bg-[#1E2A1A]/90 border border-[#3A4A36] rounded-xl px-4 py-3 animate-fade-in-up animation-delay-200">
              <div className="text-[24px] font-black text-gold leading-none">4.8★</div>
              <div className="text-[14px] text-[#9A9A8A] mt-1">Note moyenne</div>
            </div>
            <div className="bg-[#1E2A1A]/90 border border-[#3A4A36] rounded-xl px-4 py-3 animate-fade-in-up animation-delay-300">
              <div className="text-[24px] font-black text-gold leading-none">&lt; 30min</div>
              <div className="text-[14px] text-[#9A9A8A] mt-1">Temps moyen</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
