import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';

const MIN_NEXTAUTH_SECRET_BYTES = 32;

function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }
  const encoded = new TextEncoder().encode(secret);
  if (encoded.length < MIN_NEXTAUTH_SECRET_BYTES) {
    throw new Error(
      `NEXTAUTH_SECRET must be at least ${MIN_NEXTAUTH_SECRET_BYTES} bytes (256 bits). Current length: ${encoded.length} bytes.`
    );
  }
  return secret;
}

/**
 * Build the OAuth provider list, skipping any provider whose credentials are missing rather
 * than crashing later with a cryptic "Invalid client_id" error from the provider (bug #24).
 * A warning is logged at boot so misconfigured deployments are diagnosable without an OAuth
 * round-trip.
 */
function buildOAuthProviders(): Provider[] {
  const providers: Provider[] = [];
  const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (googleId && googleSecret) {
    providers.push(Google({ clientId: googleId, clientSecret: googleSecret }));
  } else {
    console.warn('[NextAuth] Google OAuth disabled — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set');
  }
  const fbId = process.env.FACEBOOK_APP_ID?.trim();
  const fbSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (fbId && fbSecret) {
    providers.push(Facebook({ clientId: fbId, clientSecret: fbSecret }));
  } else {
    console.warn('[NextAuth] Facebook OAuth disabled — FACEBOOK_APP_ID / FACEBOOK_APP_SECRET not set');
  }
  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: buildOAuthProviders(),
  secret: getNextAuthSecret(),
  callbacks: {
    /**
     * Honour NextAuth's standard `callbackUrl` query parameter when it is same-origin.
     * Otherwise fall back to the OAuth finalize bridge, which then issues our own JWT and
     * redirects to the locale-aware /auth/callback page (handled by the finalize route).
     *
     * Same-origin enforcement is critical: a permissive redirect would turn this callback
     * into an open-redirect gadget that attackers can abuse to bounce victims off the
     * site's domain right after a successful OAuth login.
     */
    async redirect({ url, baseUrl }) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || baseUrl;
      const expectedOrigin = (() => {
        try { return new URL(appUrl).origin; } catch { return null; }
      })();
      if (expectedOrigin) {
        // Accept relative URLs ("/something") by resolving against the expected origin.
        try {
          const resolved = new URL(url, expectedOrigin);
          if (resolved.origin === expectedOrigin) return resolved.toString();
        } catch {
          /* fall through to the default finalize bridge */
        }
      }
      return `${appUrl}/api/v1/auth/oauth/finalize`;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.oauthEmail = profile.email;
        token.oauthFirstName =
          (profile as Record<string, unknown>).given_name ??
          (profile.name as string | undefined)?.split(' ')[0] ??
          '';
        token.oauthLastName =
          (profile as Record<string, unknown>).family_name ??
          (profile.name as string | undefined)?.split(' ').slice(1).join(' ') ??
          '';
      }
      return token;
    },
    async session({ session, token }) {
      const s = session as unknown as Record<string, unknown>;
      s.oauthEmail = token.oauthEmail;
      s.oauthFirstName = token.oauthFirstName;
      s.oauthLastName = token.oauthLastName;
      return session;
    },
  },
  session: { strategy: 'jwt' },
  pages: {
    error: '/login',
  },
});
