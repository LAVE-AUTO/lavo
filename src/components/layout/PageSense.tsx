import Script from 'next/script';

/* NEXT_PUBLIC_PAGESENSE_ID format: "{accountId}/{scriptId}"
 * Example: "123456789/abcdefghij"
 * Found in your Zoho PageSense dashboard under Install Code. */
const PAGESENSE_ID = process.env.NEXT_PUBLIC_PAGESENSE_ID;

/* Injects the Zoho PageSense tracking script.
 * Renders nothing if NEXT_PUBLIC_PAGESENSE_ID is not set. */
export function PageSense({ nonce }: { nonce?: string }) {
  if (!PAGESENSE_ID) return null;

  return (
    <Script
      src={`https://cdn.pagesense.io/js/${PAGESENSE_ID}.js`}
      strategy="afterInteractive"
      nonce={nonce}
    />
  );
}
