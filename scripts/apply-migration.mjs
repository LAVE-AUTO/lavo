// Applies a specific migration SQL file directly to the DB.
// Usage: node scripts/apply-migration.mjs src/lib/db/migrations/0002_...sql
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

config();

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply-migration.mjs <sql-file>');
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(file), 'utf8');
const statements = sql
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  for (const stmt of statements) {
    console.log('Executing:', stmt.slice(0, 80).replace(/\n/g, ' ') + '...');
    await client.query(stmt);
  }
  console.log('Migration applied successfully.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
