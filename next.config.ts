import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost', '*.ngrok-free.app', '*.ngrok-free.dev', '*.ngrok.io'],
  reactCompiler: true,
  /** ESM package; required so Jest (next/jest) transpiles it when importing @/lib/jwt in tests. */
  transpilePackages: ["jose"],
  /** CJS packages that Next.js must not bundle — imported lazily via dynamic import in route handlers. */
  serverExternalPackages: ["cloudinary", "bcrypt"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
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
