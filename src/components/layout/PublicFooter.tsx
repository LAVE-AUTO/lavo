import Image from 'next/image';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Public footer — server component.
 * Premium layout: pre-footer CTA band + main grid + bottom bar.
 */
export async function PublicFooter() {
  const locale = await getLocale();
  const t      = await getTranslations('footer');
  const tn     = await getTranslations('nav');
  const year   = new Date().getFullYear();

  const quickLinks = [
    { href: '/',         label: tn('home') },
    { href: '/stations', label: tn('stations') },
    { href: '/login',    label: tn('login') },
    { href: '/register', label: tn('register') },
  ];

  const legalLinks = [
    { href: '#', label: t('privacy') },
    { href: '#', label: t('terms') },
    { href: '#', label: t('contact') },
    { href: '#', label: t('about') },
  ];

  return (
    <footer className="bg-[#111A0F] dark:bg-[#0A120A] text-white">

      {/* ── Pre-footer CTA band ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1A2A16] via-[#1E3018] to-[#1A2A16] border-t border-[#2C3828]">
        {/* Glow orb */}
        <div className="absolute top-0 right-0 w-[500px] h-[300px] rounded-full bg-gold/[0.06] blur-[80px] pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-[26px] sm:text-[32px] font-[900] text-white leading-tight mb-2">
              {t('cta_title')}
            </h2>
            <p className="text-[15px] text-white/55 max-w-md mx-auto md:mx-0">
              {t('cta_subtitle')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link
              href="/register"
              className="btn-shine inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-gold hover:bg-gold-hover rounded-[12px] text-[15px] font-bold text-dark-bg transition-colors"
            >
              {t('cta_register')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <Link
              href="/stations"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/15 hover:border-gold/40 hover:bg-white/5 rounded-[12px] text-[15px] font-bold text-white/80 hover:text-white transition-colors"
            >
              {t('cta_explore')}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main footer body ── */}
      <div className="border-t border-[#1E2A1A]">
        {/* Gold shimmer line */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

            {/* Brand column */}
            <div className="lg:col-span-2 space-y-5">
              {/* Logo */}
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-white/95 p-0.5 border border-gold/25 shadow-sm shrink-0">
                  <Image src="/logo/frame2.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" aria-hidden="true" />
                </div>
                <span className="text-[20px] font-[900] tracking-wide text-white">Slowtime</span>
              </div>

              <p className="text-[14px] text-white/45 leading-[1.75] max-w-[340px]">
                {t('tagline')}
              </p>

              {/* Mini stats */}
              <div className="flex gap-7 pt-1">
                {[
                  { value: '150+', label: t('stat_stations') },
                  { value: '2 500+', label: locale === 'fr' ? 'Lavages' : 'Washes' },
                  { value: '4', label: t('stat_cities') },
                ].map(({ value, label }) => (
                  <div key={label}>
                    <p className="text-[20px] font-[900] text-gold leading-none">{value}</p>
                    <p className="text-[12px] text-white/40 font-semibold mt-0.5 uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>

              {/* Service badge + status */}
              <div className="flex flex-wrap gap-2 pt-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#2C3828] bg-[#1A2A16]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 17l2-7h14l2 7" />
                    <path d="M5 17v2h2v-2M17 17v2h2v-2" />
                    <circle cx="7.5" cy="17" r="1.5" fill="#C49A1E" />
                    <circle cx="16.5" cy="17" r="1.5" fill="#C49A1E" />
                  </svg>
                  <span className="text-[11px] font-bold text-white/40 tracking-wide uppercase">
                    {locale === 'fr' ? 'Service de lavage auto' : 'Car wash service'}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#2C4A2C] bg-[#1A3020]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" aria-hidden="true" />
                  <span className="text-[11px] font-bold text-[#4ADE80] tracking-wide uppercase">{t('status_ok')}</span>
                </div>
              </div>

              {/* Social icons */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[12px] text-white/30 uppercase tracking-widest font-semibold">{t('social_follow')}</span>
                {[
                  {
                    label: 'Instagram',
                    path: 'M16 2H8C4.7 2 2 4.7 2 8v8c0 3.3 2.7 6 6 6h8c3.3 0 6-2.7 6-6V8c0-3.3-2.7-6-6-6zm4 14c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V8c0-2.2 1.8-4 4-4h8c2.2 0 4 1.8 4 4v8zm-8-10a6 6 0 100 12A6 6 0 0012 6zm0 10a4 4 0 110-8 4 4 0 010 8zm5.5-11a1.5 1.5 0 100 3 1.5 1.5 0 000-3z',
                  },
                  {
                    label: 'Facebook',
                    path: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
                  },
                  {
                    label: 'X / Twitter',
                    path: 'M4 4l16 16M4 20L20 4',
                  },
                ].map(({ label, path }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    className="w-8 h-8 rounded-lg border border-[#2C3828] bg-[#1A2A16] flex items-center justify-center text-white/30 hover:text-gold hover:border-gold/40 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div>
              <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.18em] mb-5">
                {t('quick_links')}
              </h3>
              <ul className="space-y-3">
                {quickLinks.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="group flex items-center gap-2 text-[14px] text-white/50 hover:text-gold transition-colors duration-150"
                    >
                      <span className="w-1 h-1 rounded-full bg-gold/40 group-hover:bg-gold transition-colors shrink-0" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal links */}
            <div>
              <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.18em] mb-5">
                {t('legal')}
              </h3>
              <ul className="space-y-3">
                {legalLinks.map(({ href, label }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="group flex items-center gap-2 text-[14px] text-white/50 hover:text-gold transition-colors duration-150"
                    >
                      <span className="w-1 h-1 rounded-full bg-gold/40 group-hover:bg-gold transition-colors shrink-0" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-6 border-t border-[#1E2A1A] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[12px] text-white/25">
              {t('copyright', { year })}
            </p>
            <p className="text-[12px] text-white/25">
              {t('made_with')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
