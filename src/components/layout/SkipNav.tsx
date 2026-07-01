'use client';

import { useTranslations } from 'next-intl';

/**
 * Skip-to-content link (WCAG 2.4.1). Visually hidden until it receives
 * keyboard focus, then it appears at the top of the viewport. Targets the
 * `#main-content` landmark rendered by each route group / page wrapper.
 */
export function SkipNav() {
  const t = useTranslations('nav');

  return (
    <a href="#main-content" className="skip-nav">
      {t('skip_to_content')}
    </a>
  );
}
