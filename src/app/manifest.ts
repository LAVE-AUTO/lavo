import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Slowtime',
    short_name: 'Slowtime',
    description: 'Réservation et paiement pour stations de lavage',
    start_url: '/fr',
    display: 'standalone',
    background_color: '#1A2116',
    theme_color: '#af8408',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
