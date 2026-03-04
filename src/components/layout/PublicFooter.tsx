import Image from 'next/image';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

function CarWashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17l2-7h14l2 7" />
      <path d="M5 17v2h2v-2M17 17v2h2v-2" />
      <circle cx="7.5" cy="17" r="1.5" fill="#C49A1E" />
      <circle cx="16.5" cy="17" r="1.5" fill="#C49A1E" />
    </svg>
  );
}

/**
 * Public footer — server component.
 * Displays brand info, quick links, legal links and copyright.
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
  ];

  return (
    <footer className="bg-[#1A2116] dark:bg-[#0D1A0D] text-white border-t border-[#2C3828]">
      {/* Gold top accent */}
      <div className="h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-60" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-white/95 p-0.5 border border-gold/25 shadow-sm shrink-0">
                <Image src="/logo/frame2.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" aria-hidden="true" />
              </div>
              <span className="text-[18px] font-bold tracking-wide text-white">LAVO</span>
            </div>
            <p className="text-[13px] text-lavo-muted leading-relaxed max-w-sm">
              {t('tagline')}
            </p>

            {/* Stats */}
            <div className="flex gap-6 pt-2">
              {[
                { value: '8+',   label: locale === 'fr' ? 'Stations' : 'Stations' },
                { value: '500+', label: locale === 'fr' ? 'Clients' : 'Clients' },
                { value: '2',    label: locale === 'fr' ? 'Villes' : 'Cities' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-[18px] font-black text-gold">{value}</p>
                  <p className="text-[11px] text-lavo-muted font-semibold">{label}</p>
                </div>
              ))}
            </div>

            {/* Service badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#2C3828] bg-[#243020]">
              <CarWashIcon />
              <span className="text-[11px] font-bold text-lavo-muted tracking-wide uppercase">
                {locale === 'fr' ? 'Service de lavage auto' : 'Car wash service'}
              </span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-[12px] font-bold text-lavo-muted uppercase tracking-widest mb-4">
              {t('quick_links')}
            </h3>
            <ul className="space-y-2.5">
              {quickLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-[13px] text-[#C8C8B4] hover:text-gold transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h3 className="text-[12px] font-bold text-lavo-muted uppercase tracking-widest mb-4">
              {t('legal')}
            </h3>
            <ul className="space-y-2.5">
              {legalLinks.map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-[13px] text-[#C8C8B4] hover:text-gold transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-[#2C3828] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-lavo-muted">
            {t('copyright', { year })}
          </p>
          <p className="text-[12px] text-lavo-muted">
            {t('made_with')}
          </p>
        </div>
      </div>
    </footer>
  );
}
