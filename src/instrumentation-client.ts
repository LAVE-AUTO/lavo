// Sentry initialization for the browser. Runs on every client page load.
// Captures runtime errors, Web Vitals (LCP/CLS/INP) and session replays.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sample 100% of transactions in dev, 10% in prod to stay within the free quota.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Only send events in production; avoid noise from local runs.
  enabled: process.env.NODE_ENV === "production",
  // Session Replay: no full-session sampling, but always record when an error occurs.
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
});

// Instruments App Router client-side navigations for performance tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
