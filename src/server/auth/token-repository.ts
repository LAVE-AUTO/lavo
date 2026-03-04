import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { emailVerificationTokens } from '@/lib/db/schema';

type Token = typeof emailVerificationTokens.$inferSelect;
type NewToken = typeof emailVerificationTokens.$inferInsert;

export async function createToken(data: NewToken): Promise<Token> {
  const [token] = await db
    .insert(emailVerificationTokens)
    .values(data)
    .returning();
  return token;
}

export async function findValidToken(
  token: string,
  type: string
): Promise<Token | undefined> {
  return db.query.emailVerificationTokens.findFirst({
    where: and(
      eq(emailVerificationTokens.token, token),
      eq(emailVerificationTokens.type, type),
      isNull(emailVerificationTokens.used_at),
      gt(emailVerificationTokens.expires_at, new Date())
    ),
  });
}

export async function markTokenUsed(tokenId: string): Promise<void> {
  await db
    .update(emailVerificationTokens)
    .set({ used_at: new Date() })
    .where(eq(emailVerificationTokens.id, tokenId));
}
