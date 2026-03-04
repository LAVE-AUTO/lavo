/**
 * Unit tests for Drizzle schema and relations.
 * Verifies schema index imports without error and exports all expected tables and relations.
 */
import { getTableName } from "drizzle-orm";
import {
  users,
  emailVerificationTokens,
  admins,
  adminLogs,
  stations,
  stationConfigs,
  vehicleFormats,
  timeSlots,
  reservations,
  noShowFees,
  ratings,
  notifications,
  commissionSettings,
  supportTickets,
  settings,
  settingsTypeEnum,
  usersRelations,
  emailVerificationTokensRelations,
  adminsRelations,
  adminLogsRelations,
  stationsRelations,
  stationConfigsRelations,
  vehicleFormatsRelations,
  timeSlotsRelations,
  reservationsRelations,
  noShowFeesRelations,
  ratingsRelations,
  notificationsRelations,
  commissionSettingsRelations,
  supportTicketsRelations,
} from "@/lib/db/schema";

describe("db/schema", () => {
  describe("schema import", () => {
    it("imports schema index without error", () => {
      expect(users).toBeDefined();
      expect(admins).toBeDefined();
      expect(stations).toBeDefined();
    });
  });

  // =============================================================================
  // Table exports and names (match migration and DB)
  // =============================================================================
  describe("table exports and names", () => {
    const tableSpec: [string, unknown, string][] = [
      ["users", users, "users"],
      ["emailVerificationTokens", emailVerificationTokens, "email_verification_tokens"],
      ["admins", admins, "admins"],
      ["adminLogs", adminLogs, "admin_logs"],
      ["stations", stations, "stations"],
      ["stationConfigs", stationConfigs, "station_configs"],
      ["vehicleFormats", vehicleFormats, "vehicle_formats"],
      ["timeSlots", timeSlots, "time_slots"],
      ["reservations", reservations, "reservations"],
      ["noShowFees", noShowFees, "no_show_fees"],
      ["ratings", ratings, "ratings"],
      ["notifications", notifications, "notifications"],
      ["commissionSettings", commissionSettings, "commission_settings"],
      ["supportTickets", supportTickets, "support_tickets"],
      ["settings", settings, "settings"],
    ];

    it.each(tableSpec)(
      "exports table %s with DB name %s",
      (_label, table, expectedName) => {
        expect(table).toBeDefined();
        expect(typeof table).toBe("object");
        expect(getTableName(table as Parameters<typeof getTableName>[0])).toBe(
          expectedName
        );
      }
    );

    it("exports settingsTypeEnum with expected values", () => {
      expect(settingsTypeEnum).toBeDefined();
      expect(Array.isArray(settingsTypeEnum.enumValues)).toBe(true);
      expect(settingsTypeEnum.enumValues).toContain("admin");
      expect(settingsTypeEnum.enumValues).toContain("station");
      expect(settingsTypeEnum.enumValues).toContain("user");
    });
  });

  // =============================================================================
  // Table shape: key columns exist (smoke check for schema structure)
  // =============================================================================
  describe("table shape", () => {
    it("users table has expected key columns", () => {
      expect(users.id).toBeDefined();
      expect(users.email).toBeDefined();
      expect(users.password_hash).toBeDefined();
      expect(users.status).toBeDefined();
    });

    it("reservations table has expected key columns", () => {
      expect(reservations.id).toBeDefined();
      expect(reservations.user_id).toBeDefined();
      expect(reservations.station_id).toBeDefined();
      expect(reservations.time_slot_id).toBeDefined();
      expect(reservations.status).toBeDefined();
    });

    it("stations table has expected key columns", () => {
      expect(stations.id).toBeDefined();
      expect(stations.name).toBeDefined();
      expect(stations.status).toBeDefined();
      expect(stations.approved_by).toBeDefined();
    });
  });

  // =============================================================================
  // Relations exports (used by query.with())
  // =============================================================================
  describe("relation exports", () => {
    const relationSpec: [string, unknown][] = [
      ["usersRelations", usersRelations],
      ["emailVerificationTokensRelations", emailVerificationTokensRelations],
      ["adminsRelations", adminsRelations],
      ["adminLogsRelations", adminLogsRelations],
      ["stationsRelations", stationsRelations],
      ["stationConfigsRelations", stationConfigsRelations],
      ["vehicleFormatsRelations", vehicleFormatsRelations],
      ["timeSlotsRelations", timeSlotsRelations],
      ["reservationsRelations", reservationsRelations],
      ["noShowFeesRelations", noShowFeesRelations],
      ["ratingsRelations", ratingsRelations],
      ["notificationsRelations", notificationsRelations],
      ["commissionSettingsRelations", commissionSettingsRelations],
      ["supportTicketsRelations", supportTicketsRelations],
    ];

    it.each(relationSpec)("exports relation %s", (_name, rel) => {
      expect(rel).toBeDefined();
      expect(typeof rel).toBe("object");
    });
  });
});
