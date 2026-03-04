/**
 * LAVO seed script: platform defaults, one admin, commission, one station with config and vehicle formats.
 * Run after migrations: npm run db:migrate && npm run db:seed (or after db:push).
 * Loads .env from project root; requires DATABASE_URL in the environment or .env.
 * Does not import bcrypt (native addon can segfault on some systems); uses pre-computed hash or SEED_ADMIN_PASSWORD_HASH.
 */
import "dotenv/config";
import { eq, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import {
  settings,
  admins,
  commissionSettings,
  stations,
  stationConfigs,
  vehicleFormats,
} from "../src/lib/db/schema";
import {
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD_HASH_DEFAULT,
  PLATFORM_SETTINGS,
  SEED_STATION_NAME,
  SEED_STATION_ADDRESS,
  SEED_STATION_CITY,
  SEED_VEHICLE_FORMATS,
  SEED_COMMISSION_RATE,
  SEED_STATION_CONFIG,
} from "./seed-data";

async function seed(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Run with DATABASE_URL in the environment (e.g. from .env).");
    process.exit(1);
  }
  console.log("Seeding (run db:migrate first if migrations are not applied).");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  try {
    await db.transaction(async (tx) => {
    const adminType = "admin" as const;

    const existingSettings = await tx
      .select({ key: settings.key })
      .from(settings)
      .where(and(eq(settings.type, adminType), isNull(settings.entity_id)));
    const existingKeys = new Set(existingSettings.map((r) => r.key));

    for (const { key, value } of PLATFORM_SETTINGS) {
      if (existingKeys.has(key)) continue;
      await tx.insert(settings).values({
        type: adminType,
        key,
        value,
        entity_id: null,
      });
    }
    console.log("Settings: platform defaults upserted.");

    const existingAdmins = await tx.select({ id: admins.id }).from(admins).limit(1);
    let adminId: string;
    if (existingAdmins.length > 0) {
      adminId = existingAdmins[0].id;
      console.log("Admins: reusing existing admin.");
    } else {
      const passwordHash =
        process.env.SEED_ADMIN_PASSWORD_HASH ?? SEED_ADMIN_PASSWORD_HASH_DEFAULT;
      const [inserted] = await tx
        .insert(admins)
        .values({
          email: SEED_ADMIN_EMAIL,
          password_hash: passwordHash,
          name: "LAVO Seed Admin",
        })
        .returning({ id: admins.id });
      if (!inserted) throw new Error("Failed to insert seed admin.");
      adminId = inserted.id;
      console.log("Admins: seed admin created (email: " + SEED_ADMIN_EMAIL + ").");
    }

    const existingCommission = await tx.select({ id: commissionSettings.id }).from(commissionSettings).limit(1);
    if (existingCommission.length === 0) {
      await tx.insert(commissionSettings).values({
        rate: SEED_COMMISSION_RATE,
        set_by: adminId,
        effective_at: new Date(),
      });
      console.log("Commission: default rate 10% inserted.");
    } else {
      console.log("Commission: already present, skipped.");
    }

    const existingStation = await tx
      .select({ id: stations.id })
      .from(stations)
      .where(eq(stations.name, SEED_STATION_NAME))
      .limit(1);
    let stationId: string;
    if (existingStation.length > 0) {
      stationId = existingStation[0].id;
      console.log("Stations: reusing existing seed station.");
    } else {
      const [insertedStation] = await tx
        .insert(stations)
        .values({
          name: SEED_STATION_NAME,
          address: SEED_STATION_ADDRESS,
          city: SEED_STATION_CITY,
          status: "active",
          is_open: true,
        })
        .returning({ id: stations.id });
      if (!insertedStation) throw new Error("Failed to insert seed station.");
      stationId = insertedStation.id;

      await tx.insert(stationConfigs).values({
        id: stationId,
        ...SEED_STATION_CONFIG,
      });
      console.log("Stations: seed station and config created.");
    }

    const existingFormats = await tx
      .select({ id: vehicleFormats.id })
      .from(vehicleFormats)
      .where(eq(vehicleFormats.station_id, stationId));
    if (existingFormats.length > 0) {
      console.log("Vehicle formats: already present for seed station, skipped.");
    } else {
      await tx.insert(vehicleFormats).values(
        SEED_VEHICLE_FORMATS.map((f) => ({
          station_id: stationId,
          label: f.label,
          price: f.price,
          is_active: true,
        }))
      );
      console.log("Vehicle formats: five rows inserted for seed station.");
    }
    });

    console.log("Seed completed.");
  } finally {
    await pool.end();
  }
}

export { seed };

const isMain =
  typeof require !== "undefined" && require.main === module;
if (isMain) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
