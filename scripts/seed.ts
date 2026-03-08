/**
 * LAVO comprehensive demo seed: platform settings, admin, commission, wash types,
 * station + client users, stations with configs/posts/formats/wash_types, time slots,
 * reservations (completed + future), ratings, and station aggregate scores.
 *
 * Run after schema is applied (e.g. db:push): npm run db:seed.
 * Loads .env from project root; requires DATABASE_URL.
 *
 * Full reseed: running this script replaces demo data (stations, seed users, reservations,
 * ratings, slots). Admin and platform settings are preserved or created.
 *
 * Passwords: Admin @Admin2026, Client @User2026, Station @Station2026. To avoid bcrypt at
 * runtime, run "npm run db:hash-passwords" and paste the output into scripts/seed-data.ts
 * (SEED_PASSWORD_HASH_ADMIN, SEED_PASSWORD_HASH_CLIENT, SEED_PASSWORD_HASH_STATION).
 */
import "dotenv/config";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import {
  settings,
  users,
  commissionSettings,
  stations,
  stationConfigs,
  stationPosts,
  vehicleFormats,
  stationWashTypes,
  washTypes,
  timeSlots,
  reservations,
  ratings,
  noShowFees,
  notifications,
} from "../src/lib/db/schema";
import {
  SEED_ADMIN_EMAIL,
  SEED_PASSWORD_ADMIN,
  SEED_PASSWORD_CLIENT,
  SEED_PASSWORD_STATION,
  SEED_PASSWORD_HASH_ADMIN,
  SEED_PASSWORD_HASH_CLIENT,
  SEED_PASSWORD_HASH_STATION,
  SEED_ADMIN_PASSWORD_HASH_DEFAULT,
  PLATFORM_SETTINGS,
  SEED_VEHICLE_FORMATS,
  SEED_COMMISSION_RATE,
  SEED_STATION_CONFIG,
  SEED_STATIONS,
  SEED_CLIENTS,
  SEED_CLIENT_EMAILS,
  SEED_STATION_MANAGER_EMAILS,
} from "./seed-data";

function getPasswordHash(
  plain: string,
  preComputed: string,
  envKey: string
): string {
  const envHash = process.env[envKey];
  if (envHash) return envHash;
  if (preComputed) return preComputed;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bcrypt = require("bcrypt") as { hashSync: (s: string, r: number) => string };
  return bcrypt.hashSync(plain, 10);
}

async function seed(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Run with DATABASE_URL in the environment (e.g. from .env).");
    process.exit(1);
  }
  console.log("Seeding.");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  const adminHash =
    process.env.SEED_ADMIN_PASSWORD_HASH ??
    (SEED_PASSWORD_HASH_ADMIN || getPasswordHash(SEED_PASSWORD_ADMIN, SEED_PASSWORD_HASH_ADMIN, "SEED_ADMIN_PASSWORD_HASH"));
  const clientHash =
    SEED_PASSWORD_HASH_CLIENT ||
    getPasswordHash(SEED_PASSWORD_CLIENT, SEED_PASSWORD_HASH_CLIENT, "SEED_CLIENT_PASSWORD_HASH");
  const stationHash =
    SEED_PASSWORD_HASH_STATION ||
    getPasswordHash(SEED_PASSWORD_STATION, SEED_PASSWORD_HASH_STATION, "SEED_STATION_PASSWORD_HASH");

  const adminPasswordHash = adminHash || SEED_ADMIN_PASSWORD_HASH_DEFAULT;

  try {
    await db.transaction(async (tx) => {
      const adminType = "admin" as const;
      const adminRole = "admin" as const;
      const clientRole = "client" as const;
      const stationRole = "station" as const;

      // ----- Settings -----
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

      // ----- Admin -----
      let adminId: string;
      const existingAdmins = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, adminRole))
        .limit(1);
      if (existingAdmins.length > 0) {
        adminId = existingAdmins[0].id;
        await tx.update(users).set({ password_hash: adminPasswordHash }).where(eq(users.id, adminId));
        console.log("Admins: reusing existing admin (password hash updated).");
      } else {
        const [inserted] = await tx
          .insert(users)
          .values({
            first_name: "LAVO",
            last_name: "Seed Admin",
            email: SEED_ADMIN_EMAIL,
            phone: null,
            password_hash: adminPasswordHash,
            status: "active",
            email_verified_at: null,
            stripe_customer_id: null,
            role: adminRole,
          })
          .returning({ id: users.id });
        if (!inserted) throw new Error("Failed to insert seed admin.");
        adminId = inserted.id;
        console.log("Admins: seed admin created (email: " + SEED_ADMIN_EMAIL + ").");
      }

      // ----- Commission -----
      const existingCommission = await tx
        .select({ id: commissionSettings.id })
        .from(commissionSettings)
        .limit(1);
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

      // ----- Wash types (seed if missing so db:push-only workflow works) -----
      const WASH_TYPES_SEED: Array<{ code: string; label: string; sort_order: number; is_active: boolean }> = [
        { code: "hand_wash", label: "Lavage à la main", sort_order: 1, is_active: true },
        { code: "automatic", label: "Lavage automatique", sort_order: 2, is_active: true },
        { code: "self_service", label: "Libre-service", sort_order: 3, is_active: true },
      ];
      await tx
        .insert(washTypes)
        .values(WASH_TYPES_SEED)
        .onConflictDoNothing({ target: washTypes.code });
      const washTypeRows = await tx
        .select({ id: washTypes.id, code: washTypes.code })
        .from(washTypes);
      const washTypeById = new Map(washTypeRows.map((r) => [r.code, r.id]));
      const handWashId = washTypeById.get("hand_wash");
      const automaticId = washTypeById.get("automatic");
      const selfServiceId = washTypeById.get("self_service");
      if (!handWashId || !automaticId || !selfServiceId) {
        throw new Error("wash_types: expected codes hand_wash, automatic, self_service after seed.");
      }
      console.log("Wash types: ids resolved.");

      // ----- Full reseed: delete demo data in FK order -----
      const seedStationNames = SEED_STATIONS.map((s) => s.name);
      const seedUserEmails = [...SEED_CLIENT_EMAILS, ...SEED_STATION_MANAGER_EMAILS];

      const existingStations = await tx
        .select({ id: stations.id })
        .from(stations)
        .where(inArray(stations.name, seedStationNames));
      const stationIdsToDelete = existingStations.map((r) => r.id);

      if (stationIdsToDelete.length > 0) {
        await tx.delete(ratings).where(inArray(ratings.station_id, stationIdsToDelete));
        await tx.delete(noShowFees).where(inArray(noShowFees.station_id, stationIdsToDelete));
        const resIds = await tx
          .select({ id: reservations.id })
          .from(reservations)
          .where(inArray(reservations.station_id, stationIdsToDelete));
        const resIdsList = resIds.map((r) => r.id);
        if (resIdsList.length > 0) {
          await tx.delete(notifications).where(inArray(notifications.reservation_id, resIdsList));
        }
        await tx.delete(reservations).where(inArray(reservations.station_id, stationIdsToDelete));
        await tx.delete(timeSlots).where(inArray(timeSlots.station_id, stationIdsToDelete));
        await tx.delete(stationWashTypes).where(inArray(stationWashTypes.station_id, stationIdsToDelete));
        await tx.delete(vehicleFormats).where(inArray(vehicleFormats.station_id, stationIdsToDelete));
        await tx.delete(stationPosts).where(inArray(stationPosts.station_id, stationIdsToDelete));
        await tx.delete(stationConfigs).where(inArray(stationConfigs.id, stationIdsToDelete));
        await tx.delete(stations).where(inArray(stations.id, stationIdsToDelete));
        console.log("Demo stations and dependents removed.");
      }

      const existingSeedUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.email, seedUserEmails));
      if (existingSeedUsers.length > 0) {
        const userIdsToDelete = existingSeedUsers.map((r) => r.id);
        await tx.delete(ratings).where(inArray(ratings.user_id, userIdsToDelete));
        await tx.delete(noShowFees).where(inArray(noShowFees.user_id, userIdsToDelete));
        await tx.delete(notifications).where(inArray(notifications.user_id, userIdsToDelete));
        await tx.delete(reservations).where(inArray(reservations.user_id, userIdsToDelete));
        await tx.delete(users).where(inArray(users.id, userIdsToDelete));
        console.log("Demo users (client + station) removed.");
      }

      // ----- Station users (one per station) -----
      const stationUserIds: string[] = [];
      for (const station of SEED_STATIONS) {
        const [inserted] = await tx
          .insert(users)
          .values({
            first_name: null,
            last_name: null,
            email: station.manager_email,
            phone: null,
            password_hash: stationHash,
            status: "active",
            email_verified_at: null,
            stripe_customer_id: null,
            role: stationRole,
          })
          .returning({ id: users.id });
        if (!inserted) throw new Error("Failed to insert station user: " + station.manager_email);
        stationUserIds.push(inserted.id);
      }
      console.log("Station users: " + stationUserIds.length + " created.");

      // ----- Client users -----
      const clientUserIds: string[] = [];
      for (const client of SEED_CLIENTS) {
        const [inserted] = await tx
          .insert(users)
          .values({
            first_name: client.first_name,
            last_name: client.last_name,
            email: client.email,
            phone: null,
            password_hash: clientHash,
            status: "active",
            email_verified_at: null,
            stripe_customer_id: null,
            role: clientRole,
          })
          .returning({ id: users.id });
        if (!inserted) throw new Error("Failed to insert client: " + client.email);
        clientUserIds.push(inserted.id);
      }
      console.log("Client users: " + clientUserIds.length + " created.");

      // ----- Stations + configs, posts, formats, wash_types -----
      const stationIdByIndex = new Map<number, string>();
      const vehicleFormatIdsByStationId = new Map<string, string[]>();

      for (let i = 0; i < SEED_STATIONS.length; i++) {
        const station = SEED_STATIONS[i];
        const managerId = stationUserIds[i];
        const washPostCount = station.wash_post_count ?? SEED_STATION_CONFIG.wash_post_count;
        const [insertedStation] = await tx
          .insert(stations)
          .values({
            user_id: managerId,
            name: station.name,
            address: station.address,
            city: station.city,
            description: station.description,
            service_scope: station.service_scope,
            status: "active",
            is_open: true,
            approved_by: adminId,
            approved_at: new Date(),
          })
          .returning({ id: stations.id });
        if (!insertedStation) throw new Error("Failed to insert station: " + station.name);
        const sid = insertedStation.id;
        stationIdByIndex.set(i, sid);

        await tx.insert(stationConfigs).values({
          id: sid,
          opening_time: SEED_STATION_CONFIG.opening_time,
          closing_time: SEED_STATION_CONFIG.closing_time,
          break_start: SEED_STATION_CONFIG.break_start,
          break_end: SEED_STATION_CONFIG.break_end,
          wash_duration_minutes: SEED_STATION_CONFIG.wash_duration_minutes,
          wash_post_count: washPostCount,
          late_tolerance_minutes: SEED_STATION_CONFIG.late_tolerance_minutes,
          cancellation_delay_minutes: SEED_STATION_CONFIG.cancellation_delay_minutes,
          reservation_surcharge: SEED_STATION_CONFIG.reservation_surcharge ?? null,
        });

        for (let p = 1; p <= Math.min(washPostCount, 2); p++) {
          await tx.insert(stationPosts).values({
            station_id: sid,
            position: p,
            is_active: true,
          });
        }

        const formats = station.vehicle_formats ?? SEED_VEHICLE_FORMATS;
        const formatIds: string[] = [];
        for (const f of formats) {
          const [row] = await tx
            .insert(vehicleFormats)
            .values({
              station_id: sid,
              label: f.label,
              price: f.price,
              is_active: true,
            })
            .returning({ id: vehicleFormats.id });
          if (row) formatIds.push(row.id);
        }
        vehicleFormatIdsByStationId.set(sid, formatIds);

        const codeToId = {
          hand_wash: handWashId,
          automatic: automaticId,
          self_service: selfServiceId,
        } as const;
        for (const code of station.wash_type_codes) {
          const wtId = codeToId[code];
          if (wtId) await tx.insert(stationWashTypes).values({ station_id: sid, wash_type_id: wtId });
        }
      }
      console.log("Stations (with configs, posts, formats, wash_types): " + SEED_STATIONS.length + " created.");

      // ----- Time slots: next 7 days, multiple per day; a few past for history -----
      const now = new Date();
      const slotIdsByStationId = new Map<string, string[]>();
      const durationMs = (SEED_STATION_CONFIG.wash_duration_minutes ?? 15) * 60 * 1000;

      for (const [idx, station] of SEED_STATIONS.entries()) {
        const sid = stationIdByIndex.get(idx);
        if (!sid) continue;
        const ids: string[] = [];
        const washPostCount = station.wash_post_count ?? SEED_STATION_CONFIG.wash_post_count;

        // Past: 2 days ago, a few slots
        for (let d = -2; d <= 0; d++) {
          const day = new Date(now);
          day.setDate(day.getDate() + d);
          day.setHours(8, 0, 0, 0);
          for (let s = 0; s < 4; s++) {
            const start = new Date(day.getTime() + s * durationMs);
            const end = new Date(start.getTime() + durationMs);
            const [row] = await tx
              .insert(timeSlots)
              .values({
                station_id: sid,
                start_time: start,
                end_time: end,
                capacity: washPostCount,
                booked_count: 0,
                status: "available",
              })
              .returning({ id: timeSlots.id });
            if (row) ids.push(row.id);
          }
        }

        // Future: next 7 days
        for (let d = 1; d <= 7; d++) {
          const day = new Date(now);
          day.setDate(day.getDate() + d);
          day.setHours(8, 0, 0, 0);
          const slotsPerDay = 20;
          for (let s = 0; s < slotsPerDay; s++) {
            const start = new Date(day.getTime() + s * durationMs);
            const end = new Date(start.getTime() + durationMs);
            if (start.getHours() >= 18) break;
            const [row] = await tx
              .insert(timeSlots)
              .values({
                station_id: sid,
                start_time: start,
                end_time: end,
                capacity: washPostCount,
                booked_count: 0,
                status: "available",
              })
              .returning({ id: timeSlots.id });
            if (row) ids.push(row.id);
          }
        }
        slotIdsByStationId.set(sid, ids);
      }
      console.log("Time slots: created for all stations (past + next 7 days).");

      // ----- Reservations: completed (with completed_at) + a few confirmed future -----
      const commissionRate = SEED_COMMISSION_RATE;
      const allSlotIds: { station_id: string; slot_id: string }[] = [];
      for (const [sid, slotIds] of slotIdsByStationId) {
        for (const slotId of slotIds) allSlotIds.push({ station_id: sid, slot_id: slotId });
      }

      const completedReservations: { id: string; user_id: string; station_id: string; vehicle_format_id: string; time_slot_id: string }[] = [];
      let slotIndex = 0;
      for (let r = 0; r < 25; r++) {
        const clientIdx = r % clientUserIds.length;
        const userId = clientUserIds[clientIdx];
        const stationIdx = r % SEED_STATIONS.length;
        const sid = stationIdByIndex.get(stationIdx)!;
        const formatIds = vehicleFormatIdsByStationId.get(sid)!;
        const vehicleFormatId = formatIds[r % formatIds.length];
        const slotIds = slotIdsByStationId.get(sid)!;
        const pastSlotIds = slotIds.filter((_, i) => i < 4 * 3);
        const timeSlotId = pastSlotIds[r % Math.max(1, pastSlotIds.length)];
        const [inserted] = await tx
          .insert(reservations)
          .values({
            user_id: userId,
            station_id: sid,
            vehicle_format_id: vehicleFormatId,
            entry_type: "reservation",
            time_slot_id: timeSlotId,
            status: "completed",
            amount_paid: "14.00",
            commission_rate: commissionRate,
            commission_amount: "1.40",
            station_payout: "12.60",
            completed_at: new Date(),
          })
          .returning({
            id: reservations.id,
            user_id: reservations.user_id,
            station_id: reservations.station_id,
            vehicle_format_id: reservations.vehicle_format_id,
            time_slot_id: reservations.time_slot_id,
          });
        if (inserted?.id && inserted.user_id && inserted.station_id && inserted.vehicle_format_id && inserted.time_slot_id) {
          completedReservations.push({
            id: inserted.id,
            user_id: inserted.user_id,
            station_id: inserted.station_id,
            vehicle_format_id: inserted.vehicle_format_id,
            time_slot_id: inserted.time_slot_id,
          });
          await tx
            .update(timeSlots)
            .set({ booked_count: sql`${timeSlots.booked_count} + 1` })
            .where(eq(timeSlots.id, inserted.time_slot_id));
        }
      }

      for (let r = 0; r < 8; r++) {
        const clientIdx = (25 + r) % clientUserIds.length;
        const userId = clientUserIds[clientIdx];
        const stationIdx = r % SEED_STATIONS.length;
        const sid = stationIdByIndex.get(stationIdx)!;
        const formatIds = vehicleFormatIdsByStationId.get(sid)!;
        const vehicleFormatId = formatIds[r % formatIds.length];
        const slotIds = slotIdsByStationId.get(sid)!;
        const futureSlotIds = slotIds.filter((_, i) => i >= 4 * 3);
        const timeSlotId = futureSlotIds[slotIndex % Math.max(1, futureSlotIds.length)];
        slotIndex++;
        await tx.insert(reservations).values({
          user_id: userId,
          station_id: sid,
          vehicle_format_id: vehicleFormatId,
          entry_type: "reservation",
          time_slot_id: timeSlotId,
          status: "confirmed",
          amount_paid: "14.00",
          commission_rate: commissionRate,
          commission_amount: "1.40",
          station_payout: "12.60",
        });
        await tx
          .update(timeSlots)
          .set({ booked_count: sql`${timeSlots.booked_count} + 1` })
          .where(eq(timeSlots.id, timeSlotId));
      }

      await tx.insert(reservations).values({
        user_id: clientUserIds[0],
        station_id: stationIdByIndex.get(0)!,
        vehicle_format_id: vehicleFormatIdsByStationId.get(stationIdByIndex.get(0)!)![0],
        entry_type: "queue",
        time_slot_id: null,
        status: "completed",
        amount_paid: "8.00",
        commission_rate: commissionRate,
        commission_amount: "0.80",
        station_payout: "7.20",
        completed_at: new Date(),
      });
      console.log("Reservations: completed + confirmed future + 1 queue created.");

      // ----- Ratings: one per completed reservation -----
      const comments = [
        "Très bien, rapide.",
        "Parfait, je recommande.",
        null,
        "Service correct.",
        "Très satisfait.",
      ];
      for (const res of completedReservations) {
        await tx.insert(ratings).values({
          reservation_id: res.id,
          user_id: res.user_id,
          station_id: res.station_id,
          score: 3 + (Math.abs(hashCode(res.id)) % 3),
          comment: comments[Math.abs(hashCode(res.id)) % comments.length] ?? null,
        });
      }
      console.log("Ratings: " + completedReservations.length + " created.");

      // ----- Update station average_score and total_ratings -----
      for (const [idx] of SEED_STATIONS.entries()) {
        const sid = stationIdByIndex.get(idx);
        if (!sid) continue;
        const agg = await tx
          .select({
            avg: sql<number>`coalesce(round(avg(${ratings.score})::numeric, 2), 0)`,
            cnt: sql<number>`count(*)::int`,
          })
          .from(ratings)
          .where(eq(ratings.station_id, sid));
        const row = agg[0];
        if (row && Number(row.cnt) > 0) {
          await tx
            .update(stations)
            .set({
              average_score: String(Number(row.avg)),
              total_ratings: Number(row.cnt),
            })
            .where(eq(stations.id, sid));
        }
      }
      console.log("Stations: average_score and total_ratings updated.");
    });

    console.log("Seed completed.");
  } finally {
    await pool.end();
  }
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export { seed };

const isMain = typeof require !== "undefined" && require.main === module;
if (isMain) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
