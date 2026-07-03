import type { Metadata } from "next";
import { headers } from "next/headers";
import { Rajdhani, Bebas_Neue, Playfair_Display, DM_Mono, Roboto_Mono } from "next/font/google";
import { PwaRegister } from "@/components/layout/PwaRegister";
import { GoogleAnalytics } from "@/components/layout/GoogleAnalytics";
import { PageSense } from "@/components/layout/PageSense";
import "./globals.css";

// Self-hosted via next/font (served from our own origin under /_next/static).
// Replaces the render-blocking Google Fonts @import and removes the need to
// whitelist fonts.googleapis.com / fonts.gstatic.com in the CSP.
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-rajdhani",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--ff-bebas",
  display: "swap",
});

// Variable font: weight is loaded as a range, only the styles are pinned.
const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--ff-playfair",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--ff-dm-mono",
  display: "swap",
});

// Variable font: weight loaded as a range.
const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--ff-roboto-mono",
  display: "swap",
});

const fontVariables = [
  rajdhani.variable,
  bebasNeue.variable,
  playfair.variable,
  dmMono.variable,
  robotoMono.variable,
].join(" ");

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://Hurryline.com';

export const metadata: Metadata = {
  title: {
    default: 'Hurryline | L\'anticipation en mieux',
    template: '%s | Hurryline',
  },
  description:
    'Hurryline est la plateforme de réservation et de paiement pour stations de lavage auto au Canada. Trouvez une station, réservez un créneau et lavez votre véhicule en toute simplicité.',
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
        alt: 'Hurryline - Plateforme de réservation',
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
    <html lang="fr" className={fontVariables} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://cdn-ca.pagesense.io" />
      </head>
      {/* zoom: slight global ~104% size bump for this px-based UI. Set inline
          because Tailwind v4 / Lightning CSS strips the non-standard `zoom`
          property when it goes through the CSS pipeline. */}
      <body
        className="font-rajdhani antialiased"
        style={{ zoom: '1.04' }}
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
