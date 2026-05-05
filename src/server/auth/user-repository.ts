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

export async function findByIdWithPassword(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
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

export async function updateForcePasswordChange(
  userId: string,
  value: boolean
): Promise<void> {
  await db
    .update(users)
    .set({ force_password_change: value, updated_at: new Date() })
    .where(eq(users.id, userId));
}

export async function updateEmailVerified(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ email_verified_at: new Date(), status: 'active', updated_at: new Date() })
    .where(eq(users.id, userId));
}

export async function updateProfile(
  userId: string,
  data: { first_name?: string; last_name?: string; phone?: string | null }
): Promise<SafeUser> {
  const [row] = await db
    .update(users)
    .set({ ...data, updated_at: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!row) throw new Error('Update profile failed');
  return stripPasswordHash(row);
}

export async function softDeleteUser(userId: string, emailHash: string): Promise<void> {
  await db
    .update(users)
    .set({
      status: 'deleted',
      email: `${emailHash}@deleted`,
      first_name: '[deleted]',
      last_name: '[deleted]',
      phone: null,
      updated_at: new Date(),
    })
    .where(eq(users.id, userId));
}
