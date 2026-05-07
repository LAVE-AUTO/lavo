/**
 * Quick seed: Add 2 vehicle formats for demo purposes
 * Run: npx ts-node scripts/seed-vehicle-formats.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { vehicleFormats } from "../src/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema: { vehicleFormats } });

async function main() {
  console.log("🌱 Seeding vehicle formats...");

  try {
    // Insert 2 global vehicle formats
    const formats = await db
      .insert(vehicleFormats)
      .values([
        {
          label: "Berline",
          price: "25.99",
          is_active: true,
        },
        {
          label: "SUV",
          price: "35.99",
          is_active: true,
        },
      ])
      .returning();

    console.log("✅ Seeded vehicle formats:");
    formats.forEach((f) => {
      console.log(`   - ${f.label}: $${f.price}`);
    });

    console.log("\n✅ Done! You can now test services creation.");
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
