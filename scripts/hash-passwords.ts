/**
 * One-off script to generate bcrypt hashes for seed passwords.
 * Run: npm run db:hash-passwords
 * Paste the output into scripts/seed-data.ts (SEED_PASSWORD_HASH_ADMIN, etc.).
 */
import * as bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

const PASSWORDS = {
  admin: "@Admin2026",
  client: "@User2026",
  station: "@Station2026",
} as const;

async function main(): Promise<void> {
  console.log("Generated bcrypt hashes (SALT_ROUNDS=" + SALT_ROUNDS + "):\n");
  for (const [role, password] of Object.entries(PASSWORDS)) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    console.log("SEED_PASSWORD_HASH_" + role.toUpperCase() + " = " + JSON.stringify(hash));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
