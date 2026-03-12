import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Public footer — server component.
 * Dark bg, Playfair Display logo, 4-column grid matching HTML reference.
 */
export async function PublicFooter() {
  const locale = await getLocale();
  const t      = await getTranslations('footer');
  const year   = new Date().getFullYear();

  const appLinks = [
    { href: `/${locale}/#how-it-works`, label: t('app_how'), external: true },
    { href: '/stations',                label: t('app_stations'), external: false },
    { href: '/stations/apply',          label: t('app_merchant'), external: false },
  ];

  const helpLinks = [
    { href: '/faq',                  label: t('help_faq') },
    { href: '/politique-annulation', label: t('help_cancel') },
    { href: '/support',              label: t('help_support') },
    { href: '/nous-contacter',       label: t('help_contact') },
  ];

  const legalLinks = [
    { href: '/cgu',  label: t('legal_tos') },
    { href: '#',     label: t('legal_privacy') },
    { href: '#',     label: t('legal_law25') },
    { href: '#',     label: t('legal_cookies') },
  ];

  return (
    <footer className="bg-[#0d1f0f] border-t border-[rgba(200,152,10,0.1)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-14">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-12 mb-11">

          {/* Brand column */}
          <div>
            <div className="font-playfair text-[30px] font-black text-[#c8980a] tracking-[4px] mb-3">
              Slowtime
            </div>
            <p className="text-[13px] text-[#7a9a7d] leading-[1.7] max-w-[260px]">
              {t('tagline')}
            </p>
          </div>

          {/* Application column */}
          <div>
            <div className="font-dm-mono text-[10px] tracking-[2px] uppercase text-[#c8980a] mb-[18px]">
              {t('app_col')}
            </div>
            <ul className="flex flex-col gap-[9px]">
              {appLinks.map(({ href, label, external }) => (
                <li key={label}>
                  {external ? (
                    <a href={href} className="text-[13px] text-[#7a9a7d] hover:text-[#fef9e7] transition-colors duration-300">
                      {label}
                    </a>
                  ) : (
                    <Link href={href as Parameters<typeof Link>[0]['href']} className="text-[13px] text-[#7a9a7d] hover:text-[#fef9e7] transition-colors duration-300">
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Aide column */}
          <div>
            <div className="font-dm-mono text-[10px] tracking-[2px] uppercase text-[#c8980a] mb-[18px]">
              {t('help_col')}
            </div>
            <ul className="flex flex-col gap-[9px]">
              {helpLinks.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href as Parameters<typeof Link>[0]['href']} className="text-[13px] text-[#7a9a7d] hover:text-[#fef9e7] transition-colors duration-300">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Légal column */}
          <div>
            <div className="font-dm-mono text-[10px] tracking-[2px] uppercase text-[#c8980a] mb-[18px]">
              {t('legal_col')}
            </div>
            <ul className="flex flex-col gap-[9px]">
              {legalLinks.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href as Parameters<typeof Link>[0]['href']} className="text-[13px] text-[#7a9a7d] hover:text-[#fef9e7] transition-colors duration-300">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[rgba(255,255,255,0.05)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-[#7a9a7d]">
            {t('copyright', { year })}
          </p>
          <div className="flex items-center gap-5">
            <a href="#" className="text-[11px] text-[#7a9a7d] hover:text-[#c8980a] transition-colors duration-300">
              {t('legal_privacy')}
            </a>
            <Link href="/cgu" className="text-[11px] text-[#7a9a7d] hover:text-[#c8980a] transition-colors duration-300">
              {t('legal_tos')}
            </Link>
            <a href="#" className="text-[11px] text-[#7a9a7d] hover:text-[#c8980a] transition-colors duration-300">
              {t('legal_cookies')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
