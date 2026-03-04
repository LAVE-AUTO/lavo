/**
 * Drizzle Kit config: schema location, migrations output, and DB URL.
 * Run: pnpm db:generate | db:migrate | db:studio
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./src/lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
