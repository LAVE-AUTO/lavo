'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

/**
 * Sets document.documentElement.lang to the active locale for i18n and a11y.
 * Root layout cannot access [locale], so this runs after hydration inside the locale layout.
 */
export function SetHtmlLang() {
  const locale = useLocale();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return null;
}
