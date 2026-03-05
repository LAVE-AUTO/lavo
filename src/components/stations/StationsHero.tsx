import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Hero banner at the top of the public stations list page.
 * Server component -- no client JS needed.
 * Supports light/dark mode via CSS class in globals.css.
 */
export async function StationsHero() {
  const t  = await getTranslations('stations');
  const tn = await getTranslations('nav');

  return (
    <div className="relative overflow-hidden stations-hero-bg">
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

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="flex items-center gap-12">
          {/* Left: text content */}
          <div className="flex-1 max-w-xl">
            {/* Label */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/30 bg-gold/10 mb-5 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-gold-shimmer" />
              <span className="text-[15px] font-bold text-gold uppercase tracking-widest">
                Slowtime Network
              </span>
            </div>

            {/* Title */}
            <h1 className="text-[40px] sm:text-[58px] font-[900] text-white leading-tight mb-4 animate-fade-in-up animation-delay-100">
              {t('page_title')}
            </h1>

            {/* Subtitle */}
            <p className="text-[17px] sm:text-[19px] text-white/90 leading-[1.7] mb-8 animate-fade-in-up animation-delay-200">
              {t('page_subtitle')}
            </p>

            {/* CTA */}
            <div className="flex flex-wrap gap-3 animate-fade-in-up animation-delay-300">
              <Link
                href="#stations-list"
                className="btn-shine inline-flex items-center gap-2 px-6 py-3 bg-gold hover:bg-gold-hover rounded-[10px] text-[17px] font-bold text-[#1A2116] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {t('filter_available')}
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 hover:border-gold/50 rounded-[10px] text-[17px] font-bold text-white transition-colors"
              >
                {tn('register')}
              </Link>
            </div>
          </div>

          {/* Right: floating stat badges (desktop only) */}
          <div className="hidden md:flex flex-col gap-4 shrink-0">
            <StatBadge value="150+" label="Stations partenaires" delay="100" />
            <StatBadge value="4.8" label="Note moyenne" delay="200" />
            <StatBadge value="< 30min" label="Temps moyen" delay="300" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBadge({ value, label, delay }: { value: string; label: string; delay: string }) {
  return (
    <div className={`bg-[#1E2A1A]/90 border border-[#3A4A36] rounded-xl px-4 py-3 animate-fade-in-up animation-delay-${delay}`}>
      <div className="text-[23px] font-black text-gold leading-none">{value}</div>
      <div className="text-[14px] text-white/80 mt-1">{label}</div>
    </div>
  );
}
