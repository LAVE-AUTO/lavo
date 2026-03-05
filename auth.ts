import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';

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
});
