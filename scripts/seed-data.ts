/**
 * Seed data constants for LAVO. Used by scripts/seed.ts.
 * Exported for unit testing without DB.
 */
export const SEED_ADMIN_EMAIL = "admin@lavo.local";

/** Default admin password for seed (dev only). Override with SEED_ADMIN_PASSWORD in production. */
export const SEED_ADMIN_PASSWORD_DEFAULT = "ChangeMe123!";

/** Pre-computed bcrypt hash for SEED_ADMIN_PASSWORD_DEFAULT. Seed script uses this to avoid loading bcrypt (segfault on some systems). For custom password set SEED_ADMIN_PASSWORD_HASH in .env. */
export const SEED_ADMIN_PASSWORD_HASH_DEFAULT =
  "$2b$10$q0/a/xj6fSrI/aArWuDqOO0hJVyDUwh8tCilT0vaDpAklhjgST/dm";

export const PLATFORM_SETTINGS: Array<{ key: string; value: string }> = [
  { key: "cancellation_penalty_percent", value: "20" },
  { key: "default_late_tolerance_minutes", value: "5" },
  { key: "max_rating_comment_length", value: "500" },
  { key: "email_verification_token_expiry_hours", value: "24" },
  { key: "password_reset_token_expiry_hours", value: "1" },
];

export const SEED_STATION_NAME = "LAVO Seed Station";
export const SEED_STATION_ADDRESS = "1 Place du Lavage";
export const SEED_STATION_CITY = "Paris";

export const SEED_VEHICLE_FORMATS: Array<{ label: string; price: string }> = [
  { label: "Petit", price: "8.00" },
  { label: "Moyen", price: "12.00" },
  { label: "Grand", price: "15.00" },
  { label: "SUV", price: "18.00" },
  { label: "Utilitaire", price: "22.00" },
];

export const SEED_COMMISSION_RATE = "0.1000";

export const SEED_STATION_CONFIG = {
  opening_time: "08:00:00+00",
  closing_time: "18:00:00+00",
  break_start: null as string | null,
  break_end: null as string | null,
  wash_duration_minutes: 15,
  wash_post_count: 2,
  late_tolerance_minutes: 5,
  cancellation_delay_minutes: 60,
};
