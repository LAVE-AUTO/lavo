import type { Metadata } from "next";
import { headers } from "next/headers";
import { PwaRegister } from "@/components/layout/PwaRegister";
import { GoogleAnalytics } from "@/components/layout/GoogleAnalytics";
import { PageSense } from "@/components/layout/PageSense";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://Hurryline.cm';

export const metadata: Metadata = {
  title: {
    default: 'Hurryline | L\'anticipation en mieux',
    template: '%s | Hurryline',
  },
  description:
    'Hurryline est la plateforme de réservation et de paiement pour stations de lavage auto au Cameroun. Trouvez une station, réservez un créneau et lavez votre véhicule en toute simplicité.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: 'website',
    siteName: 'Hurryline',
    title: 'Hurryline | L\'anticipation en mieux',
    description:
      'Réservez facilement un créneau dans une station de lavage auto près de chez vous.',
    url: APP_URL,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Hurryline - Plateforme de lavage auto',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hurryline | L\'anticipation en mieux',
    description:
      'Réservez facilement un créneau dans une station de lavage auto près de chez vous.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className="font-rajdhani antialiased"
        suppressHydrationWarning
      >
        <GoogleAnalytics nonce={nonce} />
        <PageSense nonce={nonce} />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
