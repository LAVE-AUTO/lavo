import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type SafeUser = Omit<User, 'password_hash'>;

function stripPasswordHash(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safe } = user;
  return safe;
}

export async function findByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

export async function findById(id: string): Promise<SafeUser | undefined> {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  return user ? stripPasswordHash(user) : undefined;
}

export async function createUser(data: NewUser): Promise<SafeUser> {
  const [user] = await db.insert(users).values(data).returning();
  return stripPasswordHash(user);
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await db
    .update(users)
    .set({ password_hash: passwordHash, updated_at: new Date() })
    .where(eq(users.id, userId));
}

export async function updateEmailVerified(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ email_verified_at: new Date(), status: 'active', updated_at: new Date() })
    .where(eq(users.id, userId));
}
