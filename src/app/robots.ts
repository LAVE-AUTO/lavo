import type { MetadataRoute } from 'next';

// Keep in sync with LOCALES in src/app/sitemap.ts.
// Defined here independently to avoid importing a large async module just for
// a string array; sitemap.ts does not export LOCALES.
const LOCALES = ['fr', 'en'] as const;

// Generate disallow paths for every locale so new locales are covered automatically.
const localeDisallow = LOCALES.flatMap((locale) => [
  `/${locale}/admin/`,
  `/${locale}/docs`,
]);

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://Hurryline.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', ...localeDisallow],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
