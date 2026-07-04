/**
 * Minimal production seed for Hurryline client handover.
 *
 * This script creates only the essential data required for a fresh production
 * deployment. It intentionally does NOT create demo stations, clients,
 * reservations, ratings, or any other synthetic data.
 *
 * What it seeds:
 *   - One initial admin account (idempotent by email)
 *   - Default platform-wide business settings (only missing keys)
 *   - Default commission rate history row (only if table is empty)
 *
 * Environment variables:
 *   - DATABASE_URL                         PostgreSQL connection string (required)
 *   - SEED_ADMIN_EMAIL                     Admin email (default: admin@hurryline.local)
 *   - SEED_ADMIN_PASSWORD                  Plaintext password to hash at runtime
 *   - SEED_ADMIN_PASSWORD_HASH             Pre-computed bcrypt hash (skips hashing)
 *   - SEED_ADMIN_FORCE_PASSWORD_CHANGE     Require password change on first login (default: true)
 *   - SEED_ADMIN_FIRST_NAME                Optional first name
 *   - SEED_ADMIN_LAST_NAME                 Optional last name
 *   - PLATFORM_COMMISSION_RATE             Default commission rate (default: 0.1000)
 *
 * Security notes:
 *   - Prefer SEED_ADMIN_PASSWORD_HASH in CI/automation so plaintext never hits logs.
 *   - When SEED_ADMIN_PASSWORD is used, the password is hashed with BCRYPT_ROUNDS.
 *   - The admin account is created with force_password_change=true by default,
 *     so the first login must change the password before accessing the platform.
 *
 * Run: npm run db:seed-production-v2
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { eq, and, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { users, commissionSettings, settings } from "../src/lib/db/schema";

// %%%%% Configuration %%%%%
// Environment-driven defaults and business-rule seed values

const DEFAULT_ADMIN_EMAIL = "admin@hurryline.local";
const DEFAULT_ADMIN_PASSWORD = "Admin@2026!";
const DEFAULT_COMMISSION_RATE = process.env.PLATFORM_COMMISSION_RATE ?? "0.1000";

/**
 * Default platform business settings inserted only when a key is missing.
 * Email-type settings (admin_notification_email, weekly_report_email) are
 * intentionally excluded: the client must configure those explicitly.
 */
const DEFAULT_PLATFORM_SETTINGS: Record<string, string> = {
  cancellation_free_window_minutes: "60",
  cancellation_penalty_percent: "20.00",
  cancellation_penalty_platform_rate: "0.70",
  cancellation_penalty_station_rate: "0.30",
  max_advance_booking_days: "7",
  rating_window_days: "7",
  default_late_tolerance_minutes: "5",
  max_tip_amount_xaf: "500",
  reminder_first_window_hours: "5",
  reminder_second_window_minutes: "30",
  max_rating_comment_length: "1000",
  max_support_message_length: "2000",
  dispute_window_days: "7",
  kyc_reminder_first_threshold_days: "30",
  kyc_reminder_second_threshold_days: "7",
  admin_log_retention_days: "365",
};

// %%%%% Types %%%%%
// Reuse the Drizzle transaction type for consistent repository-style calls

type DbTransaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];

// %%%%% Helpers %%%%%
// Validation, hashing, and runtime guards

function fail(message: string): never {
  console.error(`[seed-production-v2] ${message}`);
  process.exit(1);
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    fail(`${key} is required.`);
  }
  return value.trim();
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key]?.trim() || defaultValue;
}

function getEnvFlag(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "true" || raw === "1" || raw === "yes";
}

async function resolveAdminPasswordHash(): Promise<string> {
  const plaintext = (process.env.SEED_ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD);
  const hash = process.env.SEED_ADMIN_PASSWORD_HASH?.trim();

  if (hash) {
    // Validate that it looks like a bcrypt hash so the admin can actually log in.
    if (!hash.startsWith("$2b$") && !hash.startsWith("$2a$") && !hash.startsWith("$2y$")) {
      fail("SEED_ADMIN_PASSWORD_HASH does not look like a bcrypt hash.");
    }
    return hash;
  }

  const parsedRounds = parseInt(getEnv("BCRYPT_ROUNDS", "12"), 10);
  const bcryptRounds = Number.isFinite(parsedRounds) ? Math.max(12, parsedRounds) : 12;
  return bcrypt.hash(plaintext, bcryptRounds);
}

// %%%%% Seed steps %%%%%
// Idempotent inserts for admin, settings, and commission

async function seedAdmin(tx: DbTransaction): Promise<string> {
  const email = getEnv("SEED_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL);
  const firstName = getEnv("SEED_ADMIN_FIRST_NAME", "Hurryline");
  const lastName = getEnv("SEED_ADMIN_LAST_NAME", "Admin");
  const forcePasswordChange = getEnvFlag("SEED_ADMIN_FORCE_PASSWORD_CHANGE", true);
  const fullName = `${firstName} ${lastName}`.trim();

  const existing = await tx
    .select({ id: users.id, password_hash: users.password_hash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let adminId: string;
  let passwordHash: string;

  if (existing.length > 0) {
    adminId = existing[0].id;
    passwordHash = existing[0].password_hash ?? "";
    console.log(`Admin account already exists: ${email}`);
  } else {
    passwordHash = await resolveAdminPasswordHash();

    const [row] = await tx
      .insert(users)
      .values({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: null,
        password_hash: passwordHash,
        role: "admin",
        status: "active",
        force_password_change: forcePasswordChange,
        email_verified_at: new Date(),
      })
      .returning({ id: users.id });

    adminId = row.id;
    console.log(`Created admin account: ${email} (force_password_change=${forcePasswordChange})`);
  }

  /*
   * The legacy `admins` table is still referenced by FK constraints in the
   * database (e.g. commission_settings.set_by). We mirror the user row there
   * so downstream inserts that rely on those legacy FKs do not fail.
   */
  await tx.execute(
    sql`
    INSERT INTO "admins" ("id", "email", "password_hash", "name", "created_at", "updated_at")
    VALUES (${adminId}, ${email}, ${passwordHash}, ${fullName}, NOW(), NOW())
    ON CONFLICT ("email") DO UPDATE SET
      "password_hash" = EXCLUDED."password_hash",
      "name" = EXCLUDED."name",
      "updated_at" = NOW()
    `,
  );

  return adminId;
}

async function seedCommission(tx: DbTransaction, adminId: string): Promise<void> {
  const existing = await tx.select({ id: commissionSettings.id }).from(commissionSettings).limit(1);
  if (existing.length > 0) {
    console.log("Commission settings already present; skipping default row.");
    return;
  }

  await tx.insert(commissionSettings).values({
    rate: DEFAULT_COMMISSION_RATE,
    previous_rate: null,
    set_by: adminId,
    effective_at: new Date(),
  });

  console.log(`Created default commission rate: ${DEFAULT_COMMISSION_RATE}`);
}

async function seedPlatformSettings(tx: DbTransaction): Promise<void> {
  const existingRows = await tx
    .select({ key: settings.key })
    .from(settings)
    .where(and(eq(settings.type, "admin"), isNull(settings.entity_id)));

  const existingKeys = new Set(existingRows.map((r) => r.key));
  const missing = Object.entries(DEFAULT_PLATFORM_SETTINGS).filter(
    ([key]) => !existingKeys.has(key),
  );

  if (missing.length === 0) {
    console.log("All default platform settings already present; skipping.");
    return;
  }

  for (const [key, value] of missing) {
    await tx.insert(settings).values({
      type: "admin",
      key,
      value,
      entity_id: null,
      updated_by: null,
    });
  }

  console.log(
    `Created ${missing.length} default platform setting(s): ${missing.map(([k]) => k).join(", ")}`,
  );
}

// %%%%% Main %%%%%
// Database connection, transaction wrapper, and CLI output

async function main(): Promise<void> {
  const databaseUrl = requireEnv("DATABASE_URL");

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    await db.transaction(async (tx) => {
      const adminId = await seedAdmin(tx);
      await seedCommission(tx, adminId);
      await seedPlatformSettings(tx);
    });

    console.log("\nProduction seed completed successfully.");
    console.log(`Admin email: ${getEnv("SEED_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL)}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[seed-production-v2] Unexpected error:", error);
  process.exit(1);
});
