import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { HeroSearch } from './HeroSearch';
import type { StationsHeroMetrics } from '@/helpers/stations-metrics';

interface StationsHeroProps {
  metrics: StationsHeroMetrics;
}

/**
 * Hero banner at the top of the public stations list page.
 * Server component - receives precomputed metrics from the page so the
 * KPI badges, floating stat cards and bottom strip render live values
 * (station count, weighted average rating, total reviews, total washes).
 */
export async function StationsHero({ metrics }: StationsHeroProps) {
  const t  = await getTranslations('stations');
  const tn = await getTranslations('nav');

  const emptyLabel = t('hero_stat_empty');

  const totalLabel       = metrics.totalStations.toLocaleString();
  const ratingLabel      = metrics.avgRating != null
    ? `${metrics.avgRating.toFixed(1)} ★`
    : emptyLabel;
  const completedLabel   = metrics.completedCount > 0 ? metrics.completedCount.toLocaleString() : emptyLabel;
  const reviewsLabel     = metrics.totalReviews > 0   ? metrics.totalReviews.toLocaleString()   : emptyLabel;
  const activeBadgeLabel = t('hero_badge_active', { count: metrics.totalStations });

  return (
    <div className="relative overflow-hidden stations-hero-bg min-h-[500px] sm:min-h-[560px]">

      {/* ── Animated glow orbs ── */}
      <div
        className="absolute -top-32 -right-32 w-[580px] h-[580px] rounded-full bg-gold/[0.07] blur-[100px] animate-float-orb pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-40 -left-24 w-[480px] h-[480px] rounded-full bg-gold/5 blur-[120px] animate-float-orb pointer-events-none"
        style={{ animationDelay: '-5s' }}
        aria-hidden="true"
      />

      {/* Dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23C49A1E' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Gold shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-gold to-transparent animate-gold-shimmer" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="flex items-center gap-16">

          {/* ── Left: copy ── */}
          <div className="flex-1 max-w-[560px]">

            {/* Live badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-gold/30 bg-gold/10 backdrop-blur-sm mb-7 animate-fade-in">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#4ADE80] opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ADE80]" />
              </span>
              <span className="text-[12px] font-bold text-white/70 uppercase tracking-[0.15em]">Hurryline Network</span>
              <span className="w-px h-3 bg-white/20 shrink-0" />
              <span className="text-[12px] font-bold text-gold tracking-wide">{activeBadgeLabel}</span>
            </div>

            {/* Title */}
            <h1 className="font-black leading-[1.05] mb-5 animate-fade-in-up animation-delay-100">
              <span className="block text-[42px] sm:text-[60px] text-white">{t('page_title')}</span>
              <span className="block text-[42px] sm:text-[60px] hero-title-gradient">{t('hero_near_you')}</span>
            </h1>

            {/* Subtitle */}
            <p className="text-[17px] sm:text-[18px] text-white/70 leading-[1.75] mb-8 max-w-[460px] animate-fade-in-up animation-delay-200">
              {t('page_subtitle')}
            </p>

            {/* Search bar - dynamic client component */}
            <HeroSearch />

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 animate-fade-in-up animation-delay-400">
              <Link
                href="/register"
                className="btn-shine inline-flex items-center gap-2 px-7 py-3.5 bg-gold hover:bg-gold-hover rounded-[12px] text-[15px] font-bold text-dark-bg transition-colors"
              >
                {tn('register')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <Link
                href="#stations-list"
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/20 hover:border-gold/50 hover:bg-white/5 rounded-[12px] text-[15px] font-bold text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {t('filter_available')}
              </Link>
            </div>
          </div>

          {/* ── Right: floating stat cards (lg+) ── */}
          <div className="hidden lg:flex flex-col gap-4 shrink-0">
            <StatCard value={totalLabel}                  label={t('hero_stat_partners')} delay="200" />
            <StatCard value={ratingLabel}                 label={t('hero_stat_rating')}   delay="400" />
            <StatCard value={t('hero_stat_wait_value')}   label={t('hero_stat_wait')}     delay="600" />
          </div>
        </div>

        {/* ── Bottom stats strip ── */}
        <div className="mt-14 pt-7 border-t border-white/10 grid grid-cols-3 gap-6 animate-fade-in-up animation-delay-500">
          <BottomStat value={completedLabel}                     label={t('hero_bottom_completed')} />
          <BottomStat value={reviewsLabel}                       label={t('hero_bottom_reviews')} />
          <BottomStat value={t('hero_bottom_availability_value')} label={t('hero_bottom_availability')} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, delay }: { value: string; label: string; delay: string }) {
  return (
    <div className={`relative bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4 w-[192px] animate-float-card animation-delay-${delay} hover:border-gold/30 transition-colors overflow-hidden`}>
      <div className="absolute top-0 left-0 w-[3px] h-full bg-linear-to-b from-gold/70 via-gold/30 to-transparent" />
      <div className="text-[28px] font-black text-gold leading-none mb-1.5 pl-1">{value}</div>
      <div className="text-[13px] text-white/55 leading-tight pl-1">{label}</div>
    </div>
  );
}

function BottomStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-[24px] sm:text-[28px] font-black text-gold leading-none">{value}</div>
      <div className="text-[13px] text-white/50 mt-1.5">{label}</div>
    </div>
  );
}
