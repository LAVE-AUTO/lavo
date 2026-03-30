/**
 * Seed data constants for LAVO platform.
 *
 * Used by scripts/seed.ts to bootstrap demo database.
 * Exported for unit testing without DB access.
 *
 * Usage:
 *   - Full reseed: npm run db:seed (replaces all demo data)
 *   - Pre-computed hashes: npm run db:hash-passwords, then paste output below to skip bcrypt at runtime
 *   - Custom admin password: set SEED_ADMIN_PASSWORD_HASH env var to use custom hash
 */

// %%%%% Admin credentials %%%%%
// Demo admin account for development and testing

export const SEED_ADMIN_EMAIL = "admin@lavo.local";

/**
 * Demo passwords (dev only, change for production).
 * Use exactly these values for consistent client demos.
 */
export const SEED_PASSWORD_ADMIN = "@Admin2026";
export const SEED_PASSWORD_CLIENT = "@User2026";
export const SEED_PASSWORD_STATION = "@Station2026";


// %%%%% Pre-computed password hashes %%%%%
// Optional bcrypt hashes to avoid bcrypt at runtime

/**
 * Pre-computed bcrypt hashes (optional, empty string = generate at runtime).
 * To generate, run: npm run db:hash-passwords
 * Then paste the output into these constants to skip bcrypt during seed.
 */
export const SEED_PASSWORD_HASH_ADMIN = "";
export const SEED_PASSWORD_HASH_CLIENT = "";
export const SEED_PASSWORD_HASH_STATION = "";

/**
 * Legacy fallback for admin password.
 * Aligned to SEED_PASSWORD_ADMIN for consistent demo experience.
 */
export const SEED_ADMIN_PASSWORD_DEFAULT = SEED_PASSWORD_ADMIN;

/**
 * Legacy fallback hash (for @Admin2026 password).
 * Used only if no pre-computed hash is provided and no SEED_ADMIN_PASSWORD_HASH env override.
 */
export const SEED_ADMIN_PASSWORD_HASH_DEFAULT =
  "$2b$10$q0/a/xj6fSrI/aArWuDqOO0hJVyDUwh8tCilT0vaDpAklhjgST/dm";


// %%%%% Platform settings seed data %%%%%
// Business rule configuration seeded into database

/**
 * Seed values for all 14 whitelisted platform settings.
 * Organized by functional groups (cancellation, booking, tips, reminders, emails, content).
 * Email fields (admin_notification_email, weekly_report_email) are intentionally empty;
 * operators should configure these via the admin panel.
 */
export const PLATFORM_SETTINGS: Array<{ key: string; value: string }> = [
  // Group A: Cancellation policy
  { key: "cancellation_penalty_percent", value: "20.00" },
  { key: "cancellation_free_window_minutes", value: "60" },
  { key: "cancellation_penalty_platform_rate", value: "0.70" },
  { key: "cancellation_penalty_station_rate", value: "0.30" },

  // Group B: Reservations & booking
  { key: "max_advance_booking_days", value: "7" },
  { key: "rating_window_days", value: "7" },
  { key: "default_late_tolerance_minutes", value: "5" },

  // Group C: Tips
  { key: "max_tip_amount_xaf", value: "500" },

  // Group D: Reminders
  { key: "reminder_first_window_hours", value: "5" },
  { key: "reminder_second_window_minutes", value: "30" },

  // Group E: Notification emails (admin-configurable, leave empty for now)
  { key: "admin_notification_email", value: "" },
  { key: "weekly_report_email", value: "" },

  // Group F: Content limits
  { key: "max_rating_comment_length", value: "500" },
  { key: "max_support_message_length", value: "5000" },
];

export const SEED_COMMISSION_RATE = "0.1000";


// %%%%% Stripe connected account %%%%%
// Test account for seed stations

/**
 * Stripe Connect test account ID for seed stations.
 *
 * To create a test account:
 *   stripe accounts create --type=express --country=FR
 *
 * Set via SEED_STRIPE_ACCOUNT_ID env var or update this constant.
 * Leave empty to skip Stripe payment flow in tests.
 */
export const SEED_STRIPE_ACCOUNT_ID = process.env.SEED_STRIPE_ACCOUNT_ID ?? "";


// %%%%% Vehicle formats %%%%%
// Base vehicle categories with seed prices

/**
 * Base vehicle format labels and prices (French).
 * Stations can use these or customize slight variants.
 * Prices are in the platform currency (CAD for seed).
 */
export const SEED_VEHICLE_FORMATS: Array<{ label: string; price: string }> = [
  { label: "Petit", price: "8.00" },
  { label: "Moyen", price: "12.00" },
  { label: "Grand", price: "15.00" },
  { label: "SUV", price: "18.00" },
  { label: "Utilitaire", price: "22.00" },
];


// %%%%% Station configuration %%%%%
// Default settings for seed stations

export const SEED_STATION_CONFIG = {
  opening_time: "08:00:00+00",
  closing_time: "18:00:00+00",
  break_start: null as string | null,
  break_end: null as string | null,
  wash_duration_minutes: 15,
  wash_post_count: 2,
  late_tolerance_minutes: 5,
  cancellation_delay_minutes: 60,
  reservation_surcharge: "2.00" as string | null,
};


// %%%%% Wash types %%%%%
// Wash service categories referenced by stations

/**
 * Wash type codes (from migration 0008).
 * Seed selects by code to link station_wash_types.
 */
export const WASH_TYPE_CODES = ["hand_wash", "automatic", "self_service"] as const;

/**
 * Stations for demo: name, city, address, description, service_scope.
 * wash_type_codes: 1-3 codes per station (hand_wash, automatic, self_service).
 */
export const SEED_STATIONS: Array<{
  name: string;
  city: string;
  address: string;
  description: string | null;
  service_scope: "exterior" | "interior" | "both";
  wash_type_codes: Array<"hand_wash" | "automatic" | "self_service">;
  manager_email: string;
  /** Optional variant: fewer formats or different prices. */
  vehicle_formats?: Array<{ label: string; price: string }>;
  wash_post_count?: number;
}> = [
  {
    name: "LAVO Paris Centre",
    city: "Paris",
    address: "12 rue de Rivoli",
    description: "Lavage main et automatique en plein cœur de Paris.",
    service_scope: "both",
    wash_type_codes: ["hand_wash", "automatic"],
    manager_email: "station.paris@lavo.demo",
    wash_post_count: 2,
  },
  {
    name: "LAVO Lyon Confluence",
    city: "Lyon",
    address: "5 quai Rambaud",
    description: "Station libre-service et lavage automatique.",
    service_scope: "exterior",
    wash_type_codes: ["self_service", "automatic"],
    manager_email: "station.lyon@lavo.demo",
    wash_post_count: 2,
  },
  {
    name: "LAVO Marseille Vieux-Port",
    city: "Marseille",
    address: "3 rue Paradis",
    description: "Lavage à la main et intérieur/extérieur.",
    service_scope: "both",
    wash_type_codes: ["hand_wash", "automatic"],
    manager_email: "station.marseille@lavo.demo",
    wash_post_count: 2,
  },
  {
    name: "LAVO Bordeaux Saint-Pierre",
    city: "Bordeaux",
    address: "8 place de la Bourse",
    description: "Libre-service et automatique.",
    service_scope: "exterior",
    wash_type_codes: ["self_service", "automatic"],
    manager_email: "station.bordeaux@lavo.demo",
    wash_post_count: 1,
  },
  {
    name: "LAVO Toulouse Capitole",
    city: "Toulouse",
    address: "2 rue du Taur",
    description: "Lavage main, soin intérieur et extérieur.",
    service_scope: "both",
    wash_type_codes: ["hand_wash", "automatic", "self_service"],
    manager_email: "station.toulouse@lavo.demo",
    wash_post_count: 2,
  },
  {
    name: "LAVO Nantes Commerce",
    city: "Nantes",
    address: "15 rue du Commerce",
    description: "Station automatique rapide.",
    service_scope: "exterior",
    wash_type_codes: ["automatic"],
    manager_email: "station.nantes@lavo.demo",
    wash_post_count: 2,
  },
  {
    name: "LAVO Strasbourg Grande Île",
    city: "Strasbourg",
    address: "7 rue des Orfèvres",
    description: "Lavage main et libre-service.",
    service_scope: "both",
    wash_type_codes: ["hand_wash", "self_service"],
    manager_email: "station.strasbourg@lavo.demo",
    wash_post_count: 2,
  },
];

/** Client users (role = client). Passwords use SEED_PASSWORD_CLIENT. */
export const SEED_CLIENTS: Array<{
  email: string;
  first_name: string;
  last_name: string;
}> = [
  { email: "alice@lavo.demo", first_name: "Alice", last_name: "Martin" },
  { email: "bob@lavo.demo", first_name: "Bob", last_name: "Bernard" },
  { email: "claire@lavo.demo", first_name: "Claire", last_name: "Dubois" },
  { email: "david@lavo.demo", first_name: "David", last_name: "Petit" },
  { email: "emma@lavo.demo", first_name: "Emma", last_name: "Robert" },
  { email: "francois@lavo.demo", first_name: "François", last_name: "Richard" },
  { email: "lea@lavo.demo", first_name: "Léa", last_name: "Durand" },
];

/** All seed client emails (for cleanup before reseed). */
export const SEED_CLIENT_EMAILS = SEED_CLIENTS.map((c) => c.email);

/** All seed station manager emails (for cleanup before reseed). */
export const SEED_STATION_MANAGER_EMAILS = SEED_STATIONS.map((s) => s.manager_email);

/** Legacy single-station constants (first station); kept for tests and backward compat. */
export const SEED_STATION_NAME = SEED_STATIONS[0].name;
export const SEED_STATION_ADDRESS = SEED_STATIONS[0].address;
export const SEED_STATION_CITY = SEED_STATIONS[0].city;
