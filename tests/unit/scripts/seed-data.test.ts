/**
 * Unit tests for seed data constants. No DB connection.
 * Ensures platform settings keys, vehicle format labels/prices, and station defaults match expected values.
 */
import {
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD_DEFAULT,
  PLATFORM_SETTINGS,
  SEED_STATION_NAME,
  SEED_STATION_ADDRESS,
  SEED_STATION_CITY,
  SEED_VEHICLE_FORMATS,
  SEED_COMMISSION_RATE,
  SEED_STATION_CONFIG,
} from "../../../scripts/seed-data";

describe("seed-data", () => {
  describe("SEED_ADMIN_EMAIL", () => {
    it("is the expected admin email", () => {
      expect(SEED_ADMIN_EMAIL).toBe("admin@Hurryline.local");
    });
  });

  describe("SEED_ADMIN_PASSWORD_DEFAULT", () => {
    it("is a non-empty string for dev seed", () => {
      expect(typeof SEED_ADMIN_PASSWORD_DEFAULT).toBe("string");
      expect(SEED_ADMIN_PASSWORD_DEFAULT.length).toBeGreaterThan(0);
    });
    it("matches demo admin password", () => {
      expect(SEED_ADMIN_PASSWORD_DEFAULT).toBe("@Admin2026");
    });
  });

  // ---------------------------------------------------------------------------
  // Platform settings keys and values (contract for seed script)
  // ---------------------------------------------------------------------------
  describe("PLATFORM_SETTINGS", () => {
    // All 14 platform-configurable keys + 2 backend token-expiry keys = 16 entries.
    const expectedKeys = [
      // Group A - Cancellation policy
      "cancellation_penalty_percent",
      "cancellation_free_window_minutes",
      "cancellation_penalty_platform_rate",
      "cancellation_penalty_station_rate",
      // Group B - Reservations & booking
      "max_advance_booking_days",
      "rating_window_days",
      "default_late_tolerance_minutes",
      // Group C - Tips
      "max_tip_amount_xaf",
      // Group D - Reminders
      "reminder_first_window_hours",
      "reminder_second_window_minutes",
      // Group E - Notification emails
      "admin_notification_email",
      "weekly_report_email",
      // Group F - Content limits
      "max_rating_comment_length",
      "max_support_message_length",
      // Backend configuration (not admin-configurable via API)
      "email_verification_token_expiry_hours",
      "password_reset_token_expiry_hours",
    ];

    it("has exactly the expected number of entries", () => {
      expect(PLATFORM_SETTINGS).toHaveLength(expectedKeys.length);
    });

    it("has all expected keys with string values", () => {
      const keys = PLATFORM_SETTINGS.map((s) => s.key);
      expect(keys.sort()).toEqual([...expectedKeys].sort());
      PLATFORM_SETTINGS.forEach((s) => {
        expect(typeof s.key).toBe("string");
        expect(typeof s.value).toBe("string");
        expect(s.key.length).toBeGreaterThan(0);
        // email keys are intentionally empty strings in seed
      });
    });

    it("has expected values for known keys", () => {
      const byKey = Object.fromEntries(PLATFORM_SETTINGS.map((s) => [s.key, s.value]));
      expect(byKey.cancellation_penalty_percent).toBe("20.00");
      expect(byKey.cancellation_free_window_minutes).toBe("60");
      expect(byKey.cancellation_penalty_platform_rate).toBe("0.70");
      expect(byKey.cancellation_penalty_station_rate).toBe("0.30");
      expect(byKey.max_advance_booking_days).toBe("7");
      expect(byKey.rating_window_days).toBe("7");
      expect(byKey.default_late_tolerance_minutes).toBe("5");
      expect(byKey.max_tip_amount_xaf).toBe("500");
      expect(byKey.reminder_first_window_hours).toBe("5");
      expect(byKey.reminder_second_window_minutes).toBe("30");
      expect(byKey.max_rating_comment_length).toBe("500");
      expect(byKey.max_support_message_length).toBe("5000");
      expect(byKey.email_verification_token_expiry_hours).toBe("24");
      expect(byKey.password_reset_token_expiry_hours).toBe("1");
    });
  });

  // ---------------------------------------------------------------------------
  // Station defaults
  // ---------------------------------------------------------------------------
  describe("seed station constants", () => {
    it("SEED_STATION_NAME is set (legacy: first station)", () => {
      expect(SEED_STATION_NAME).toBe("Hurryline Paris Centre");
    });
    it("SEED_STATION_ADDRESS is set", () => {
      expect(SEED_STATION_ADDRESS).toBe("12 rue de Rivoli");
    });
    it("SEED_STATION_CITY is set", () => {
      expect(SEED_STATION_CITY).toBe("Paris");
    });
  });

  // ---------------------------------------------------------------------------
  // Vehicle format labels and prices
  // ---------------------------------------------------------------------------
  describe("SEED_VEHICLE_FORMATS", () => {
    const expectedFormats = [
      { label: "Petit", price: "8.00" },
      { label: "Moyen", price: "12.00" },
      { label: "Grand", price: "15.00" },
      { label: "SUV", price: "18.00" },
      { label: "Utilitaire", price: "22.00" },
    ];

    it("has exactly five formats", () => {
      expect(SEED_VEHICLE_FORMATS).toHaveLength(5);
    });

    it("matches expected labels and prices in order", () => {
      expect(SEED_VEHICLE_FORMATS).toEqual(expectedFormats);
    });

    it("each format has label and price as non-empty strings", () => {
      SEED_VEHICLE_FORMATS.forEach((f) => {
        expect(typeof f.label).toBe("string");
        expect(typeof f.price).toBe("string");
        expect(f.label.length).toBeGreaterThan(0);
        expect(f.price.length).toBeGreaterThan(0);
      });
    });
  });

  describe("SEED_COMMISSION_RATE", () => {
    it("is the default 10% rate", () => {
      expect(SEED_COMMISSION_RATE).toBe("0.1000");
    });
  });

  describe("SEED_STATION_CONFIG", () => {
    it("has required schedule and capacity fields", () => {
      expect(SEED_STATION_CONFIG.opening_time).toBe("08:00:00+00");
      expect(SEED_STATION_CONFIG.closing_time).toBe("18:00:00+00");
      expect(SEED_STATION_CONFIG.wash_duration_minutes).toBe(15);
      expect(SEED_STATION_CONFIG.wash_post_count).toBe(2);
      expect(SEED_STATION_CONFIG.late_tolerance_minutes).toBe(5);
      expect(SEED_STATION_CONFIG.cancellation_delay_minutes).toBe(60);
    });
    it("has null break times", () => {
      expect(SEED_STATION_CONFIG.break_start).toBeNull();
      expect(SEED_STATION_CONFIG.break_end).toBeNull();
    });
  });
});
