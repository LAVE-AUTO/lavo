import { createHash, randomBytes } from 'crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { refreshTokens } from '@/lib/db/schema';

export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function createRefreshToken(
  userId: string,
  rawToken: string,
  expiresAt: Date
) {
  const [record] = await db
    .insert(refreshTokens)
    .values({
      user_id: userId,
      token_hash: hashToken(rawToken),
      expires_at: expiresAt,
    })
    .returning();
  return record;
}

export async function findValidRefreshToken(rawToken: string) {
  const hash = hashToken(rawToken);
  const now = new Date();
  return db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.token_hash, hash),
      isNull(refreshTokens.revoked_at),
      gt(refreshTokens.expires_at, now)
    ),
  });
}

export async function revokeRefreshToken(id: string) {
  await db
    .update(refreshTokens)
    .set({ revoked_at: new Date() })
    .where(eq(refreshTokens.id, id));
}

export async function revokeAllRefreshTokensForUser(userId: string) {
  await db
    .update(refreshTokens)
    .set({ revoked_at: new Date() })
    .where(
      and(eq(refreshTokens.user_id, userId), isNull(refreshTokens.revoked_at))
    );
}
