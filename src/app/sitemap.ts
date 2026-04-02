import type { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lavo.cm';
const LOCALES = ['fr', 'en'] as const;

/**
 * Attempts to load active station IDs for the sitemap.
 * Returns an empty array if the database is unavailable (e.g. during static build).
 */
async function getStationIds(): Promise<string[]> {
  try {
    // Dynamic import keeps the DB client out of the module evaluation path
    // so a missing DATABASE_URL during static export does not crash the build.
    const { listActiveStations } = await import(
      '@/server/station/station-repository'
    );
    const { rows } = await listActiveStations({ page: 1, per_page: 1000 });
    return rows.map((s: { id: string }) => s.id);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static routes present in the router
  const staticRoutes: MetadataRoute.Sitemap = LOCALES.flatMap((locale) => [
    {
      url: `${APP_URL}/${locale}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 1.0,
    },
    {
      url: `${APP_URL}/${locale}/stations`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${APP_URL}/${locale}/cgu`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    },
    {
      url: `${APP_URL}/${locale}/cgu-stations`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${APP_URL}/${locale}/mentions-legales`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${APP_URL}/${locale}/politique-de-confidentialite`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${APP_URL}/${locale}/politique-annulation`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${APP_URL}/${locale}/faq`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${APP_URL}/${locale}/nous-contacter`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
  ]);

  // Dynamic station pages
  const stationIds = await getStationIds();
  const stationRoutes: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    stationIds.map((id) => ({
      url: `${APP_URL}/${locale}/stations/${id}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  );

  return [...staticRoutes, ...stationRoutes];
}
