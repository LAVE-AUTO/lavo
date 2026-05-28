import { getTranslations, setRequestLocale } from 'next-intl/server';
import { safeJsonLd } from '@/lib/json-ld';
import { getStationDetailPublic } from '@/server/station/station-service';
import { StationDetail } from '@/components/stations/StationDetail';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://Hurryline.cm';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'stations' });
  let name = t('page_title');
  let description = t('page_subtitle');
  try {
    const station = await getStationDetailPublic(id);
    if (station) {
      name = station.name;
      if (station.description) description = station.description;
    }
  } catch {
    // fallback to defaults
  }
  return {
    title: `Hurryline - ${name}`,
    description,
    alternates: {
      canonical: `${APP_URL}/${locale}/stations/${id}`,
    },
    openGraph: {
      type: 'website' as const,
      url: `${APP_URL}/${locale}/stations/${id}`,
      title: `Hurryline - ${name}`,
      description,
    },
  };
}

/**
 * Builds a LocalBusiness JSON-LD object for a station.
 * Returns null when station data is unavailable.
 */
async function buildLocalBusinessJsonLd(
  id: string,
  locale: string
): Promise<Record<string, unknown> | null> {
  try {
    const station = await getStationDetailPublic(id);
    if (!station) return null;

    const addressParts = [station.address, station.city].filter(Boolean);

    return {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${APP_URL}/${locale}/stations/${id}`,
      name: station.name,
      description: station.description ?? undefined,
      url: `${APP_URL}/${locale}/stations/${id}`,
      ...(addressParts.length > 0 && {
        address: {
          '@type': 'PostalAddress',
          streetAddress: station.address ?? undefined,
          addressLocality: station.city ?? undefined,
          addressCountry: 'CM',
        },
      }),
      ...(station.latitude != null &&
        station.longitude != null && {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: station.latitude,
            longitude: station.longitude,
          },
        }),
      priceRange: '$$',
    };
  } catch {
    return null;
  }
}

/**
 * Public station detail page.
 * Reads station ID from async params and passes it to the client StationDetail.
 */
export default async function StationDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const jsonLd = await buildLocalBusinessJsonLd(id, locale);

  return (
    <main className="min-h-screen bg-[#FFF9EC] dark:bg-background transition-colors">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
      )}
      <StationDetail id={id} />
    </main>
  );
}