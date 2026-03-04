import { sql } from "drizzle-orm";

// Migration to unify admins into users with a role enum.
// Assumes an existing schema with separate admins table and related FKs.

export async function up(db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) {
  // 1) Role enum and column on users
  await db.execute(
    sql`CREATE TYPE "user_role" AS ENUM ('admin', 'client', 'station');`,
  );

  await db.execute(
    sql`ALTER TABLE "users" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'client';`,
  );

  await db.execute(sql`CREATE INDEX "users_role_idx" ON "users" ("role");`);

  // 2) Point adminLogs, commissionSettings, stations, supportTickets to users instead of admins
  // admin_logs.admin_id -> users.id
  await db.execute(
    sql`ALTER TABLE "admin_logs" DROP CONSTRAINT IF EXISTS "admin_logs_admin_id_admins_id_fk";`,
  );
  await db.execute(
    sql`ALTER TABLE "admin_logs" DROP CONSTRAINT IF EXISTS "admin_logs_admin_id_fkey";`,
  );
  await db.execute(
    sql`ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE;`,
  );

  // commission_settings.set_by -> users.id
  await db.execute(
    sql`ALTER TABLE "commission_settings" DROP CONSTRAINT IF EXISTS "commission_settings_set_by_admins_id_fk";`,
  );
  await db.execute(
    sql`ALTER TABLE "commission_settings" DROP CONSTRAINT IF EXISTS "commission_settings_set_by_fkey";`,
  );
  await db.execute(
    sql`ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "users"("id") ON DELETE CASCADE;`,
  );

  // stations.approved_by -> users.id
  await db.execute(
    sql`ALTER TABLE "stations" DROP CONSTRAINT IF EXISTS "stations_approved_by_admins_id_fk";`,
  );
  await db.execute(
    sql`ALTER TABLE "stations" DROP CONSTRAINT IF EXISTS "stations_approved_by_fkey";`,
  );
  await db.execute(
    sql`ALTER TABLE "stations" ADD CONSTRAINT "stations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id");`,
  );

  // support_tickets.assigned_to -> users.id
  await db.execute(
    sql`ALTER TABLE "support_tickets" DROP CONSTRAINT IF EXISTS "support_tickets_assigned_to_admins_id_fk";`,
  );
  await db.execute(
    sql`ALTER TABLE "support_tickets" DROP CONSTRAINT IF EXISTS "support_tickets_assigned_to_fkey";`,
  );
  await db.execute(
    sql`ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL;`,
  );

  // 3) Drop admins table (no longer used)
  await db.execute(sql`DROP TABLE IF EXISTS "admins";`);
}

export async function down(db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) {
  // Best-effort partial rollback: recreate admins table and FKs, and drop role column/enum.
  // Structure is based on the previous schema.

  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS "admins" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "email" varchar(255) NOT NULL UNIQUE,
      "password_hash" text NOT NULL,
      "name" varchar(200) NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );`,
  );

  // admin_logs.admin_id -> admins.id
  await db.execute(
    sql`ALTER TABLE "admin_logs" DROP CONSTRAINT IF EXISTS "admin_logs_admin_id_users_id_fk";`,
  );
  await db.execute(
    sql`ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE;`,
  );

  // commission_settings.set_by -> admins.id
  await db.execute(
    sql`ALTER TABLE "commission_settings" DROP CONSTRAINT IF EXISTS "commission_settings_set_by_users_id_fk";`,
  );
  await db.execute(
    sql`ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_set_by_admins_id_fk" FOREIGN KEY ("set_by") REFERENCES "admins"("id") ON DELETE CASCADE;`,
  );

  // stations.approved_by -> admins.id
  await db.execute(
    sql`ALTER TABLE "stations" DROP CONSTRAINT IF EXISTS "stations_approved_by_users_id_fk";`,
  );
  await db.execute(
    sql`ALTER TABLE "stations" ADD CONSTRAINT "stations_approved_by_admins_id_fk" FOREIGN KEY ("approved_by") REFERENCES "admins"("id");`,
  );

  // support_tickets.assigned_to -> admins.id
  await db.execute(
    sql`ALTER TABLE "support_tickets" DROP CONSTRAINT IF EXISTS "support_tickets_assigned_to_users_id_fk";`,
  );
  await db.execute(
    sql`ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_admins_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "admins"("id") ON DELETE SET NULL;`,
  );

  // Remove role index, column and enum from users
  await db.execute(sql`DROP INDEX IF EXISTS "users_role_idx";`);
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "role";`);
  await db.execute(sql`DROP TYPE IF EXISTS "user_role";`);
}

