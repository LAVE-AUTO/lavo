// Sentry initialization for the Edge runtime (middleware, edge routes).
// Loaded by src/instrumentation.ts when NEXT_RUNTIME === "edge".
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: process.env.NODE_ENV === "production",
  enableLogs: true,
});
