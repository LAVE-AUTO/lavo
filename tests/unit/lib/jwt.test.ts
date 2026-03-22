/**
 * Unit tests for JWT verify/sign behavior, including audience when expected from env.
 * Node environment: jose uses structuredClone (not available in jsdom test env).
 *
 * @jest-environment node
 */
import { SignJWT } from 'jose';
import { signJwt, verifyJwt, type JwtPayload } from '@/lib/jwt';

const SECRET = '01234567890123456789012345678901';

const basePayload: JwtPayload = {
  sub: 'user-1',
  role: 'user',
  email: 'test@example.com',
  status: 'active',
  force_password_change: false,
};

const ENV_KEYS = ['JWT_SECRET', 'NEXT_PUBLIC_APP_URL', 'JWT_AUDIENCE', 'JWT_ISSUER'] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const s: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) s[k] = process.env[k];
  return s;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const k of ENV_KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('jwt', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = snapshotEnv();
    process.env.JWT_SECRET = SECRET;
    delete process.env.JWT_AUDIENCE;
    delete process.env.JWT_ISSUER;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    restoreEnv(saved);
  });

  describe('verifyJwt audience', () => {
    it('returns null when NEXT_PUBLIC_APP_URL implies audience but token omits aud', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      const token = await new SignJWT({ ...basePayload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(new TextEncoder().encode(SECRET));

      await expect(verifyJwt(token)).resolves.toBeNull();
    });

    it('returns null when JWT_AUDIENCE is set but token omits aud', async () => {
      process.env.JWT_AUDIENCE = 'https://api.example';
      const token = await new SignJWT({ ...basePayload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(new TextEncoder().encode(SECRET));

      await expect(verifyJwt(token)).resolves.toBeNull();
    });

    it('verifies when NEXT_PUBLIC_APP_URL is set and token aud matches URL origin', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com/app/dashboard';
      const token = await signJwt(basePayload);
      await expect(verifyJwt(token)).resolves.toMatchObject({
        sub: basePayload.sub,
        email: basePayload.email,
      });
    });

    it('returns null when expected audience does not match token aud', async () => {
      process.env.JWT_AUDIENCE = 'https://expected-audience.example';
      const token = await new SignJWT({ ...basePayload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setAudience('https://wrong.example')
        .sign(new TextEncoder().encode(SECRET));

      await expect(verifyJwt(token)).resolves.toBeNull();
    });

    it('verifies token without aud when no audience is configured (legacy)', async () => {
      const token = await new SignJWT({ ...basePayload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(new TextEncoder().encode(SECRET));

      await expect(verifyJwt(token)).resolves.toMatchObject({
        sub: basePayload.sub,
      });
    });

    it('uses JWT_AUDIENCE over NEXT_PUBLIC_APP_URL when both are set', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      process.env.JWT_AUDIENCE = 'https://custom-aud.example';

      const tokenForCustom = await new SignJWT({ ...basePayload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setAudience('https://custom-aud.example')
        .sign(new TextEncoder().encode(SECRET));
      await expect(verifyJwt(tokenForCustom)).resolves.toMatchObject({
        sub: basePayload.sub,
      });

      const tokenForOriginOnly = await new SignJWT({ ...basePayload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setAudience('https://app.example.com')
        .sign(new TextEncoder().encode(SECRET));
      await expect(verifyJwt(tokenForOriginOnly)).resolves.toBeNull();
    });
  });
});
