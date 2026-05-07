import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/layout/PwaRegister";
import { GoogleAnalytics } from "@/components/layout/GoogleAnalytics";
import { PageSense } from "@/components/layout/PageSense";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lavo.cm';

export const metadata: Metadata = {
  title: {
    default: 'LAVO - Réservation de lavage auto',
    template: '%s | LAVO',
  },
  description:
    'LAVO est la plateforme de réservation et de paiement pour stations de lavage auto au Cameroun. Trouvez une station, réservez un créneau et lavez votre véhicule en toute simplicité.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: 'website',
    siteName: 'LAVO',
    title: 'LAVO - Réservation de lavage auto',
    description:
      'Réservez facilement un créneau dans une station de lavage auto près de chez vous.',
    url: APP_URL,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LAVO - Plateforme de lavage auto',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LAVO - Réservation de lavage auto',
    description:
      'Réservez facilement un créneau dans une station de lavage auto près de chez vous.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleAnalytics />
        <PageSense />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
