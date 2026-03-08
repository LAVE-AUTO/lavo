/**
 * Seed data constants for LAVO. Used by scripts/seed.ts.
 * Exported for unit testing without DB.
 *
 * Demo seed: run "npm run db:seed" for a full reseed (replaces demo data).
 * To use pre-computed password hashes and avoid bcrypt at runtime, run
 * "npm run db:hash-passwords" and paste the output into the SEED_PASSWORD_HASH_* constants below.
 */

export const SEED_ADMIN_EMAIL = "admin@lavo.local";

/** Passwords for demo (dev only). Use exactly these for client demos. */
export const SEED_PASSWORD_ADMIN = "@Admin2026";
export const SEED_PASSWORD_CLIENT = "@User2026";
export const SEED_PASSWORD_STATION = "@Station2026";

/**
 * Pre-computed bcrypt hashes (optional). If set, seed uses them and does not need bcrypt at runtime.
 * Generate with: npm run db:hash-passwords
 */
export const SEED_PASSWORD_HASH_ADMIN = "";
export const SEED_PASSWORD_HASH_CLIENT = "";
export const SEED_PASSWORD_HASH_STATION = "";

/** Legacy: default admin password for dev seed. Aligned to demo password. */
export const SEED_ADMIN_PASSWORD_DEFAULT = SEED_PASSWORD_ADMIN;

/** Legacy: default admin password hash; used only if no pre-computed hash and no env override. */
export const SEED_ADMIN_PASSWORD_HASH_DEFAULT =
  "$2b$10$q0/a/xj6fSrI/aArWuDqOO0hJVyDUwh8tCilT0vaDpAklhjgST/dm";

export const PLATFORM_SETTINGS: Array<{ key: string; value: string }> = [
  { key: "cancellation_penalty_percent", value: "20" },
  { key: "default_late_tolerance_minutes", value: "5" },
  { key: "max_rating_comment_length", value: "500" },
  { key: "email_verification_token_expiry_hours", value: "24" },
  { key: "password_reset_token_expiry_hours", value: "1" },
];

export const SEED_COMMISSION_RATE = "0.1000";

/** Base vehicle format labels/prices; stations can use these or slight variants. */
export const SEED_VEHICLE_FORMATS: Array<{ label: string; price: string }> = [
  { label: "Petit", price: "8.00" },
  { label: "Moyen", price: "12.00" },
  { label: "Grand", price: "15.00" },
  { label: "SUV", price: "18.00" },
  { label: "Utilitaire", price: "22.00" },
];

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

/** Wash type codes from migration 0008. Seed selects by code to link station_wash_types. */
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
