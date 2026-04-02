import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lavo.cm';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/fr/admin/', '/en/admin/'],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
