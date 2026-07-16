import Image from 'next/image';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function MerchantFooter() {
  const locale = await getLocale();
  const t = await getTranslations('merchant.footer');
  const year = new Date().getFullYear();

  const marchandLinks = [
    { href: `/${locale}/merchant#how-it-works`, label: t('marchands_how'), external: true },
    { href: `/${locale}/merchant#features`, label: t('marchands_features'), external: true },
    { href: `/${locale}/merchant#features`, label: t('marchands_pricing'), external: true },
    { href: '/station/apply', label: t('marchands_join'), external: false },
  ];

  const resourceLinks = [
    { href: '/faq', label: t('resources_guide') },
    { href: '/faq', label: t('resources_faq') },
    { href: '/support', label: t('resources_support') },
    { href: '/nous-contacter', label: t('resources_contact') },
  ];

  const legalLinks = [
    { href: '/cgu-stations', label: t('legal_tos') },
    { href: '/politique-de-confidentialite', label: t('legal_privacy') },
    { href: '/politique-annulation', label: t('legal_cancel') },
    { href: '/politique-de-confidentialite', label: t('legal_law25') },
  ];

  return (
    <footer className="bg-dark-bg border-t border-[rgba(221,175,59,0.1)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-12 mb-11">

          {/* Brand column */}
          <div>
            <div className="mb-3">
              <Image
                src="/logo/logo_anglais_2.png"
                alt="Hurryline"
                width={160}
                height={36}
                className="h-9 w-auto"
              />
            </div>
            <p className="text-[13px] text-[#B0BFB1] leading-[1.7] max-w-[260px]">
              {t('tagline')}
            </p>
          </div>

          {/* Marchands column */}
          <div>
            <div className="font-dm-mono text-[10px] tracking-[2px] uppercase text-[#DDAF3B] mb-[18px]">
              {t('marchands_col')}
            </div>
            <ul className="flex flex-col gap-[9px]">
              {marchandLinks.map(({ href, label, external }) => (
                <li key={label}>
                  {external ? (
                    <a href={href} className="text-[13px] text-[#B0BFB1] hover:text-[#FFEECA] transition-colors duration-300">
                      {label}
                    </a>
                  ) : (
                    <Link href={href as Parameters<typeof Link>[0]['href']} className="text-[13px] text-[#B0BFB1] hover:text-[#FFEECA] transition-colors duration-300">
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Resources column */}
          <div>
            <div className="font-dm-mono text-[10px] tracking-[2px] uppercase text-[#DDAF3B] mb-[18px]">
              {t('resources_col')}
            </div>
            <ul className="flex flex-col gap-[9px]">
              {resourceLinks.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href as Parameters<typeof Link>[0]['href']} className="text-[13px] text-[#B0BFB1] hover:text-[#FFEECA] transition-colors duration-300">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <div className="font-dm-mono text-[10px] tracking-[2px] uppercase text-[#DDAF3B] mb-[18px]">
              {t('legal_col')}
            </div>
            <ul className="flex flex-col gap-[9px]">
              {legalLinks.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href as Parameters<typeof Link>[0]['href']} className="text-[13px] text-[#B0BFB1] hover:text-[#FFEECA] transition-colors duration-300">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[rgba(255,255,255,0.05)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-[#B0BFB1]">
            {t('copyright', { year })}
          </p>
          <div className="flex items-center gap-5">
            <Link href="/politique-de-confidentialite" className="text-[11px] text-[#B0BFB1] hover:text-[#DDAF3B] transition-colors duration-300">
              {t('legal_privacy')}
            </Link>
            <Link href="/cgu-stations" className="text-[11px] text-[#B0BFB1] hover:text-[#DDAF3B] transition-colors duration-300">
              {t('legal_tos')}
            </Link>
            <Link href="/politique-annulation" className="text-[11px] text-[#B0BFB1] hover:text-[#DDAF3B] transition-colors duration-300">
              {t('legal_cancel')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
