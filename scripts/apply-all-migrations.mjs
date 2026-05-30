// Applies every SQL migration file in src/lib/db/migrations/ in numeric order.
//
// USE CASE: fresh-deploy DBs (e.g. Railway production on first connect). One command brings
// a brand-new empty database up to the current schema.
//
// WHY NOT `drizzle-kit migrate`: the project's meta/_journal.json is out of sync with the
// SQL files on disk (the team has added migrations manually). drizzle-kit only applies what
// the journal references, so 0039+ would be skipped on a fresh DB. This script walks the
// filesystem and applies everything ordered by the numeric prefix.
//
// NOT FOR PARTIALLY-APPLIED DBs: some early migrations were written before the team adopted
// IF NOT EXISTS guards and contain plain `CREATE TYPE` / constraint definitions. On a DB
// where some statements have already been applied (e.g. our dev DB), running this script
// will hit "type already exists" or FK conflicts on those old statements.
// For incremental apply on an existing DB, use:
//     node scripts/apply-migration.mjs src/lib/db/migrations/<file>.sql
//
// SAFETY NET: each statement runs in its own transaction. Known "already exists" PG codes
// (42710, 42P07, 42701, …) are caught and reported, so a re-run on a fresh-but-restarted DB
// finishes cleanly. Other errors (FK violations, syntax) abort the run with the file name.
//
// Usage:
//   DATABASE_URL=postgresql://... node scripts/apply-all-migrations.mjs
//   # or via npm:
//   npm run db:migrate-all

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../src/lib/db/migrations');

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => {
      // Numeric prefix sort so 0009 < 0010 < 0042 < 0051.
      const match = name.match(/^(\d+)/);
      const idx = match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
      return { name, idx, path: path.join(MIGRATIONS_DIR, name) };
    })
    .sort((a, b) => a.idx - b.idx || a.name.localeCompare(b.name));
}

function splitStatements(sql) {
  // Drizzle separates statements with `--> statement-breakpoint`. Run each separately so a
  // partial failure inside a multi-statement file rolls back cleanly within its transaction.
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s && !s.split('\n').every((l) => l.trim().startsWith('--')));
}

// Postgres error codes that map to "the object already exists" — safe to skip when re-running
// migrations on a partially-applied DB (some early migration files use bare CREATE TYPE / CREATE
// TABLE without IF NOT EXISTS guards).
const ALREADY_EXISTS_CODES = new Set([
  '42710', // duplicate_object (CREATE TYPE, CREATE EXTENSION, etc.)
  '42P07', // duplicate_table
  '42701', // duplicate_column
  '42P06', // duplicate_schema
  '42723', // duplicate_function
  '42P16', // invalid_table_definition (e.g. adding existing constraint)
]);

async function applyFile(client, file) {
  const sql = fs.readFileSync(file.path, 'utf8');
  const statements = splitStatements(sql);
  if (statements.length === 0) {
    console.log(`  · ${file.name} — empty, skipped`);
    return;
  }
  let applied = 0;
  let skipped = 0;
  for (const stmt of statements) {
    // Each statement runs in its own savepoint-style transaction so an "already exists"
    // statement is skipped without poisoning the subsequent statements in the same file.
    await client.query('BEGIN');
    try {
      await client.query(stmt);
      await client.query('COMMIT');
      applied += 1;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (err.code && ALREADY_EXISTS_CODES.has(err.code)) {
        skipped += 1;
        continue;
      }
      throw new Error(`Migration ${file.name} failed: ${err.message}`);
    }
  }
  const tag = skipped > 0 ? `${applied} applied, ${skipped} skipped (already exists)` : `${applied} stmt`;
  console.log(`  ✓ ${file.name} (${tag})`);
}

const files = listMigrationFiles();
console.log(`Applying ${files.length} migrations to ${redactUrl(process.env.DATABASE_URL)}\n`);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  for (const file of files) {
    await applyFile(client, file);
  }
  console.log(`\nAll migrations applied successfully.`);
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
} finally {
  await client.end();
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '<masked>';
  }
}
