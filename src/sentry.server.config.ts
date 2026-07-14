// Sentry initialization for the Node.js server runtime.
// Loaded by src/instrumentation.ts when NEXT_RUNTIME === "nodejs".
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Sample 100% of transactions in dev, 10% in prod to stay within the free quota.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Only send events in production; avoid noise from local runs.
  enabled: process.env.NODE_ENV === "production",
  enableLogs: true,
});
