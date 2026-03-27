import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

function buildCsp(): string {
  // Keep this CSP compatible with Next.js while still providing meaningful protection.
  // In development, Next tooling can require eval/inline scripts, so we relax it.
  if (!isProd) {
    return [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "frame-src https://js.stripe.com",
      "connect-src 'self' https: ws: https://api.stripe.com",
    ].join("; ");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    // Keep 'unsafe-inline' for styles to avoid breaking Next.js/Tailwind class injection,
    // but avoid it for scripts in production to reduce XSS risk.
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' https://js.stripe.com",
    "frame-src https://js.stripe.com",
    "connect-src 'self' https: https://api.stripe.com",
    "upgrade-insecure-requests",
  ].join("; ");
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok-free.dev', '*.ngrok.io'],
  reactCompiler: true,
  /** ESM package; required so Jest (next/jest) transpiles it when importing @/lib/jwt in tests. */
  transpilePackages: ["jose"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: buildCsp() },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
