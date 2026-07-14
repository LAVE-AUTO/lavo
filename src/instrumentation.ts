/**
 * Next.js instrumentation hook - runs once when the server starts.
 * Forces IPv4-first DNS resolution so that outbound Node.js fetch requests
 * (e.g. NextAuth token endpoint calls to oauth2.googleapis.com) do not
 * time out on environments where IPv6 is advertised by DNS but blocked at
 * the network level.
 *
 * The dns module is only available in the Node.js runtime, not Edge.
 *
 * Also loads the matching Sentry runtime config for error and performance
 * monitoring, and forwards server-side request errors via onRequestError.
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dns = await import('dns');
    dns.setDefaultResultOrder('ipv4first');
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
