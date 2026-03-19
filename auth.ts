import NextAuth from 'next-auth';
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Facebook({
      clientId: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
    }),
  ],
  secret: getNextAuthSecret(),
  callbacks: {
    async redirect() {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
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
    error: '/fr/login',
  },
});
