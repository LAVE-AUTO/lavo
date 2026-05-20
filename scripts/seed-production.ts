/**
 * Production-like seed: simulates a Hurryline platform live for ~10 months.
 *
 * Generates a realistic dataset:
 *   - 1 admin (kept if already present)
 *   - 12 active stations across Québec cities (configs, posts, photos, hours,
 *     vehicle formats, wash types)
 *   - 12 station managers + 100 verified clients with French names
 *   - ~3 000 historical reservations spread over the last 10 months
 *     (completed / cancelled / no-show mix), plus ~50 future bookings
 *   - ~800 queue entries over the same period
 *   - Ratings on ~70 % of completed reservations (skewed positive 4-5 stars)
 *   - Sample delay requests + reschedule audit rows + support tickets
 *
 * All seeded users get the email prefix "prod-seed." so we can detect and
 * REPLACE them on subsequent runs (full reseed of the production-like dataset
 * only, demo seed and live data are untouched).
 *
 * Run: npm run db:seed-production
 *
 * Default passwords (dev only):
 *   admin   admin@hurryline.local        / @Admin2026
 *   station prod-seed.<city>.demo        / @Station2026
 *   client  prod-seed.<name>.<n>@...demo / @User2026
 */
import "dotenv/config";
import { eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import {
  adminLogs,
  commissionSettings,
  delayRequests,
  disputes,
  extraVehicleEntries,
  favorites,
  noShowFees,
  notifications,
  ratings,
  rescheduleRequests,
  reservationTips,
  reservations,
  serviceExtraCompatibility,
  serviceVehicleEntries,
  settings,
  stationConfigs,
  stationDocuments,
  stationExtras,
  stationHourExceptions,
  stationHours,
  stationPhotos,
  stationPosts,
  stationServices,
  stationWashTypes,
  stations,
  supportMessages,
  supportTickets,
  timeSlots,
  userNotificationPrefs,
  userNotifications,
  users,
  vehicleFormats,
  washTypes,
} from "../src/lib/db/schema";


// %%%%% Constants %%%%%
// Seed scale, identifiers, and reusable static data

const SEED_TAG = "prod-seed";
const SEED_USER_PREFIX = `${SEED_TAG}.`;
const HISTORY_MONTHS = 10;
const FUTURE_DAYS = 14;
const TOTAL_CLIENTS = 100;
const TOTAL_RESERVATIONS = 3000;
const TOTAL_QUEUE = 800;
const FUTURE_RESERVATIONS = 50;
const FUTURE_QUEUE = 20;
const COMMISSION_RATE = "0.1000";
/* Bcrypt hashes pre-computed at cost=10 (fast enough for seed, safe for dev).
 * Override individual roles via SEED_HASH_ADMIN / SEED_HASH_STATION / SEED_HASH_CLIENT env vars.
 * Re-generate with: node -e "require('bcrypt').hash('<pw>',10).then(console.log)" */
const HASH_ADMIN =
  process.env.SEED_HASH_ADMIN ??
  "$2b$10$W7m7WoFK/mh2UVqwGU11AujeVpQ8yzjB.JRB2WWewyQ/PD7pGJtqS"; /* @Admin2026 */
const HASH_STATION =
  process.env.SEED_HASH_STATION ??
  "$2b$10$5X1kQMT1m9tx2lb56PofUO0N/rAlLqIYHA1UeN4QVDsajoZfEYQ1e"; /* @Station2026 */
const HASH_CLIENT =
  process.env.SEED_HASH_CLIENT ??
  "$2b$10$53EiujNvl0tquP1UGMXMfeKPS/9xpjHd424L5CU2TFqLeVyeP23.K"; /* @User2026 */

const FRENCH_FIRST_NAMES = [
  "Alexandre", "Amélie", "Antoine", "Arthur", "Camille", "Catherine", "Charlotte",
  "Christophe", "Claire", "Claudine", "David", "Emmanuel", "Émilie", "Étienne",
  "François", "Frédéric", "Gabriel", "Geneviève", "Guillaume", "Hélène", "Isabelle",
  "Jacques", "Jean", "Jean-Philippe", "Jérôme", "Julie", "Julien", "Justine",
  "Karine", "Laurent", "Léa", "Léo", "Louis", "Lucas", "Manon", "Marc", "Maria",
  "Marianne", "Marie", "Marine", "Mathieu", "Maxime", "Michel", "Nathalie",
  "Nicolas", "Noé", "Olivia", "Olivier", "Patrick", "Paul", "Pauline",
  "Philippe", "Pierre", "Raphaël", "Robert", "Sandrine", "Sébastien", "Simon",
  "Sophie", "Stéphane", "Sylvie", "Thomas", "Valérie", "Victor", "Vincent",
  "Xavier", "Yannick", "Zoé",
];
const FRENCH_LAST_NAMES = [
  "Bélanger", "Bergeron", "Bouchard", "Bourgeois", "Caron", "Côté", "Couture",
  "Desjardins", "Dubé", "Dufour", "Dumont", "Fortin", "Gagnon", "Gauthier",
  "Gervais", "Girard", "Grenier", "Lachance", "Lafleur", "Lambert", "Landry",
  "Langlois", "Lapointe", "Laroche", "Lavoie", "Leblanc", "Lebrun", "Leclerc",
  "Lefebvre", "Lefèvre", "Légaré", "Lévesque", "Marchand", "Martel", "Martin",
  "Ouellet", "Paquette", "Paradis", "Pelletier", "Perreault", "Pichette",
  "Plamondon", "Poirier", "Proulx", "Richard", "Rivest", "Robichaud", "Roy",
  "Simard", "St-Pierre", "Tremblay", "Turcotte", "Vachon", "Vaillancourt",
];

interface CityProfile {
  name: string;
  address: string;
  postal: string;
  lat: number;
  lng: number;
  managerEmail: string;
  description: string;
  scope: "exterior" | "interior" | "both";
  washTypes: Array<"hand_wash" | "automatic" | "self_service">;
  postCount: number;
  duration: number;
  surcharge: string | null;
  photos: string[];
}

const CITY_PROFILES: CityProfile[] = [
  {
    name: "Hurryline Montréal Plateau",
    address: "1450 avenue du Mont-Royal Est",
    postal: "H2J 1Y6",
    lat: 45.5314,
    lng: -73.5772,
    managerEmail: "station.plateau@hurryline.demo",
    description: "Lavage main et soin intérieur en plein cœur du Plateau.",
    scope: "both",
    washTypes: ["hand_wash", "automatic"],
    postCount: 4,
    duration: 20,
    surcharge: "2.50",
    photos: [
      "https://images.unsplash.com/photo-1605618826115-fb9e0c93b9c1?w=1200",
      "https://images.unsplash.com/photo-1607861716497-e65ab29fc7ac?w=1200",
    ],
  },
  {
    name: "Hurryline Montréal Vieux-Port",
    address: "275 rue de la Commune Ouest",
    postal: "H2Y 2C9",
    lat: 45.5050,
    lng: -73.5547,
    managerEmail: "station.vieuxport@hurryline.demo",
    description: "Service complet à deux pas du Vieux-Port. Salle d'attente premium.",
    scope: "both",
    washTypes: ["hand_wash", "automatic", "self_service"],
    postCount: 5,
    duration: 25,
    surcharge: "3.00",
    photos: [
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200",
      "https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=1200",
    ],
  },
  {
    name: "Hurryline Laval Centropolis",
    address: "1900 boulevard de l'Avenir",
    postal: "H7S 2N4",
    lat: 45.5589,
    lng: -73.7437,
    managerEmail: "station.laval@hurryline.demo",
    description: "Station express avec deux postes automatiques et lavage main.",
    scope: "exterior",
    washTypes: ["automatic", "self_service"],
    postCount: 3,
    duration: 15,
    surcharge: "2.00",
    photos: [
      "https://images.unsplash.com/photo-1597007030739-6d2e7172ee6c?w=1200",
    ],
  },
  {
    name: "Hurryline Longueuil Place Charles-Le Moyne",
    address: "1111 rue Saint-Charles Ouest",
    postal: "J4K 5G4",
    lat: 45.5332,
    lng: -73.5187,
    managerEmail: "station.longueuil@hurryline.demo",
    description: "Réservation rapide, équipe formée pour les véhicules utilitaires.",
    scope: "exterior",
    washTypes: ["hand_wash", "automatic"],
    postCount: 4,
    duration: 20,
    surcharge: "2.50",
    photos: [
      "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=1200",
    ],
  },
  {
    name: "Hurryline Brossard Quartier DIX30",
    address: "9120 boulevard Leduc",
    postal: "J4Y 0K2",
    lat: 45.4505,
    lng: -73.4683,
    managerEmail: "station.brossard@hurryline.demo",
    description: "Trois bays haut de gamme + nettoyage cuir et finition céramique.",
    scope: "both",
    washTypes: ["hand_wash", "automatic"],
    postCount: 5,
    duration: 30,
    surcharge: "4.00",
    photos: [
      "https://images.unsplash.com/photo-1601150281826-cef253b3d20f?w=1200",
      "https://images.unsplash.com/photo-1635268321820-6ee9a4f8bba0?w=1200",
    ],
  },
  {
    name: "Hurryline Québec Sainte-Foy",
    address: "2700 boulevard Laurier",
    postal: "G1V 2L8",
    lat: 46.7783,
    lng: -71.2786,
    managerEmail: "station.quebec@hurryline.demo",
    description: "Service au volant. Stationnement clientèle inclus.",
    scope: "both",
    washTypes: ["hand_wash", "automatic", "self_service"],
    postCount: 4,
    duration: 20,
    surcharge: "2.50",
    photos: [
      "https://images.unsplash.com/photo-1601758174611-52f0a1fa2f04?w=1200",
    ],
  },
  {
    name: "Hurryline Sherbrooke King Ouest",
    address: "1845 rue King Ouest",
    postal: "J1J 2E2",
    lat: 45.4042,
    lng: -71.9214,
    managerEmail: "station.sherbrooke@hurryline.demo",
    description: "Station familiale, équipe bilingue.",
    scope: "exterior",
    washTypes: ["automatic", "self_service"],
    postCount: 3,
    duration: 15,
    surcharge: "2.00",
    photos: [
      "https://images.unsplash.com/photo-1605618826115-fb9e0c93b9c1?w=1200",
    ],
  },
  {
    name: "Hurryline Trois-Rivières Centre",
    address: "1655 boulevard du Saint-Maurice",
    postal: "G9A 3R3",
    lat: 46.3433,
    lng: -72.5436,
    managerEmail: "station.troisrivieres@hurryline.demo",
    description: "Express 15 min, équipement neuf installé en 2024.",
    scope: "exterior",
    washTypes: ["automatic"],
    postCount: 2,
    duration: 15,
    surcharge: "2.00",
    photos: [
      "https://images.unsplash.com/photo-1607861716497-e65ab29fc7ac?w=1200",
    ],
  },
  {
    name: "Hurryline Gatineau Hull",
    address: "320 boulevard Saint-Joseph",
    postal: "J8Y 3Z2",
    lat: 45.4297,
    lng: -75.7019,
    managerEmail: "station.gatineau@hurryline.demo",
    description: "Près du pont Alexandra. Lavage main et automatique.",
    scope: "both",
    washTypes: ["hand_wash", "automatic"],
    postCount: 3,
    duration: 20,
    surcharge: "2.50",
    photos: [
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200",
    ],
  },
  {
    name: "Hurryline Saguenay Chicoutimi",
    address: "1225 boulevard Talbot",
    postal: "G7H 4B6",
    lat: 48.4053,
    lng: -71.0686,
    managerEmail: "station.saguenay@hurryline.demo",
    description: "Service hivernal renforcé. Dégivrage et lustrage inclus.",
    scope: "exterior",
    washTypes: ["automatic", "self_service"],
    postCount: 3,
    duration: 20,
    surcharge: "2.50",
    photos: [
      "https://images.unsplash.com/photo-1597007030739-6d2e7172ee6c?w=1200",
    ],
  },
  {
    name: "Hurryline Laval Rive-Sud",
    address: "3045 boulevard Saint-Martin Ouest",
    postal: "H7T 2P5",
    lat: 45.5497,
    lng: -73.7747,
    managerEmail: "station.lavalsud@hurryline.demo",
    description: "Équipe formée à la finition haut de gamme.",
    scope: "both",
    washTypes: ["hand_wash", "automatic"],
    postCount: 4,
    duration: 25,
    surcharge: "3.00",
    photos: [
      "https://images.unsplash.com/photo-1601150281826-cef253b3d20f?w=1200",
    ],
  },
  {
    name: "Hurryline Montréal Saint-Laurent",
    address: "975 boulevard Décarie",
    postal: "H4L 3M2",
    lat: 45.5066,
    lng: -73.6792,
    managerEmail: "station.stlaurent@hurryline.demo",
    description: "Bay double, idéale pour SUV et utilitaires.",
    scope: "both",
    washTypes: ["hand_wash", "automatic", "self_service"],
    postCount: 4,
    duration: 20,
    surcharge: "2.50",
    photos: [
      "https://images.unsplash.com/photo-1635268321820-6ee9a4f8bba0?w=1200",
    ],
  },
];

interface ScenarioProfile {
  name: string;
  address: string;
  postal: string;
  lat: number;
  lng: number;
  managerEmail: string;
  description: string;
  status: "pending_admin_validation" | "rejected" | "inactive";
  rejectionReason?: string;
  docs: Array<"business_license" | "insurance" | "identity_document">;
}

/* Non-active stations: cover KYC/validation/closed scenarios. */
const SCENARIO_PROFILES: ScenarioProfile[] = [
  {
    name: "Hurryline Repentigny (En attente de validation)",
    address: "850 rue Notre-Dame",
    postal: "J6A 2Y8",
    lat: 45.7414, lng: -73.4572,
    managerEmail: "station.repentigny@hurryline.demo",
    description: "Nouvelle station en attente de validation administrative.",
    status: "pending_admin_validation",
    docs: ["business_license", "insurance"],
  },
  {
    name: "Hurryline Joliette (Documents incomplets)",
    address: "100 boulevard Dollard",
    postal: "J6E 4M3",
    lat: 46.0251, lng: -73.4486,
    managerEmail: "station.joliette@hurryline.demo",
    description: "Dossier de validation en cours, documents partiels.",
    status: "pending_admin_validation",
    docs: ["business_license"],
  },
  {
    name: "Hurryline Saint-Hyacinthe (Rejetée)",
    address: "1590 avenue Johnson",
    postal: "J2S 7V3",
    lat: 45.6261, lng: -72.9572,
    managerEmail: "station.sthyacinthe@hurryline.demo",
    description: "Station ayant soumis des documents non conformes.",
    status: "rejected",
    rejectionReason: "Les documents soumis ne correspondent pas au registre des entreprises du Québec. Veuillez soumettre des documents à jour et dûment certifiés.",
    docs: ["business_license"],
  },
  {
    name: "Hurryline Drummondville (Temporairement fermée)",
    address: "505 boulevard Saint-Joseph",
    postal: "J2C 2C1",
    lat: 45.8842, lng: -72.4796,
    managerEmail: "station.drummondville@hurryline.demo",
    description: "Station temporairement fermée pour travaux de rénovation.",
    status: "inactive",
    docs: ["business_license", "insurance", "identity_document"],
  },
];

const DOC_URLS: Record<string, string> = {
  business_license: "https://res.cloudinary.com/demo/image/upload/sample.pdf",
  insurance: "https://res.cloudinary.com/demo/image/upload/sample2.pdf",
  identity_document: "https://res.cloudinary.com/demo/image/upload/sample3.pdf",
};

/* Vehicle formats ramped up so amount_paid totals look realistic. Each station
 * gets a slightly different price grid to mimic real pricing variability. */
const FORMAT_BASE: Array<{ label: string; basePrice: number }> = [
  { label: "Compacte", basePrice: 12 },
  { label: "Berline", basePrice: 16 },
  { label: "VUS", basePrice: 22 },
  { label: "Camionnette", basePrice: 26 },
  { label: "Utilitaire", basePrice: 32 },
];

const RATING_COMMENTS: Array<string | null> = [
  "Service rapide et impeccable. Je recommande.",
  "Très satisfait, voiture comme neuve.",
  "Personnel courtois, lavage soigné.",
  "Bon rapport qualité-prix.",
  "Rapide mais quelques traces sur le pare-brise.",
  null,
  "Parfait, je reviendrai.",
  "Excellent travail sur l'intérieur.",
  "Bien, sans plus.",
  "Toujours nickel, équipe au top.",
  null,
  "Trop d'attente à mon goût mais beau résultat.",
  "Application pratique, prise de RDV facile.",
  "Lavage moyen, je m'attendais à mieux.",
  "Très bonne expérience, à recommander.",
  null,
  "Service au top, comme d'habitude.",
];

const SUPPORT_SUBJECTS = [
  { subject: "Problème de paiement", body: "J'ai été débité deux fois pour la même réservation. Pouvez-vous vérifier ?" },
  { subject: "Demande de remboursement", body: "La station n'était pas ouverte à mon arrivée, je n'ai pas pu être servi." },
  { subject: "Modification de réservation", body: "Je n'arrive pas à modifier l'heure de mon créneau de demain." },
  { subject: "Question sur les forfaits", body: "Quelle est la différence entre Berline et VUS dans votre tarif ?" },
  { subject: "Application qui plante", body: "L'app se ferme dès que j'ouvre l'écran de paiement." },
  { subject: "Compte bloqué", body: "Je ne peux plus me connecter depuis hier. Pouvez-vous m'aider ?" },
];


// %%%%% Random helpers %%%%%
// Deterministic PRNG so reseeding produces the same dataset

let rngState = 1234567;
function rand(): number {
  /* mulberry32-style: cheap, deterministic, sufficient for seed data. */
  rngState = (rngState + 0x6D2B79F5) | 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function pickWeighted<T>(items: Array<{ value: T; weight: number }>): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = rand() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.value;
  }
  return items[items.length - 1].value;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomTicketCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return out;
}

function isoMinute(d: Date): Date {
  const c = new Date(d);
  c.setSeconds(0, 0);
  return c;
}


// %%%%% Cleanup of previous prod-seed run %%%%%
// Re-running the script wipes the previous prod-seed dataset before reseeding

async function cleanupPreviousSeed(tx: any): Promise<void> {
  const prevUsers = await tx
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(like(users.email, `${SEED_USER_PREFIX}%`));
  if (prevUsers.length === 0) {
    console.log("Cleanup: no previous prod-seed users found.");
    return;
  }
  const userIds = prevUsers.map((u: any) => u.id);
  const stationUserIds = prevUsers.filter((u: any) => u.role === "station").map((u: any) => u.id);

  const prevStations = stationUserIds.length > 0
    ? await tx.select({ id: stations.id }).from(stations).where(inArray(stations.user_id, stationUserIds))
    : [];
  const stationIds: string[] = prevStations.map((s: any) => s.id);

  if (stationIds.length > 0) {
    /* Reservation rows must die before the slots/stations they FK to. */
    const rowsRes = await tx.select({ id: reservations.id })
      .from(reservations)
      .where(inArray(reservations.station_id, stationIds));
    const resIds: string[] = rowsRes.map((r: any) => r.id);
    if (resIds.length > 0) {
      /* Explicit deletes — do not rely on DB-level CASCADE which may not be present
         in older migration snapshots. Order matters: children before parents. */
      await tx.delete(disputes).where(inArray(disputes.reservation_id, resIds));
      await tx.delete(reservationTips).where(inArray(reservationTips.reservation_id, resIds));
      await tx.delete(notifications).where(inArray(notifications.reservation_id, resIds));
      await tx.delete(ratings).where(inArray(ratings.reservation_id, resIds));
      await tx.delete(noShowFees).where(inArray(noShowFees.reservation_id, resIds));
      await tx.delete(delayRequests).where(inArray(delayRequests.reservation_id, resIds));
      await tx.delete(rescheduleRequests).where(inArray(rescheduleRequests.original_reservation_id, resIds));
      await tx.delete(reservations).where(inArray(reservations.id, resIds));
    }
    await tx.delete(favorites).where(inArray(favorites.station_id, stationIds));
    await tx.delete(timeSlots).where(inArray(timeSlots.station_id, stationIds));
    await tx.delete(stationDocuments).where(inArray(stationDocuments.station_id, stationIds));
    await tx.delete(stationPhotos).where(inArray(stationPhotos.station_id, stationIds));
    await tx.delete(stationHours).where(inArray(stationHours.station_id, stationIds));
    await tx.delete(stationHourExceptions).where(inArray(stationHourExceptions.station_id, stationIds));
    await tx.delete(stationWashTypes).where(inArray(stationWashTypes.station_id, stationIds));
    await tx.delete(stationPosts).where(inArray(stationPosts.station_id, stationIds));
    /* Station services + extras (and their cross-table children). */
    const prevServices = await tx.select({ id: stationServices.id }).from(stationServices).where(inArray(stationServices.station_id, stationIds));
    const serviceIds: string[] = prevServices.map((s: { id: string }) => s.id);
    if (serviceIds.length > 0) {
      await tx.delete(serviceExtraCompatibility).where(inArray(serviceExtraCompatibility.service_id, serviceIds));
      await tx.delete(serviceVehicleEntries).where(inArray(serviceVehicleEntries.service_id, serviceIds));
      await tx.delete(stationServices).where(inArray(stationServices.id, serviceIds));
    }
    const prevExtras = await tx.select({ id: stationExtras.id }).from(stationExtras).where(inArray(stationExtras.station_id, stationIds));
    const extraIds: string[] = prevExtras.map((e: { id: string }) => e.id);
    if (extraIds.length > 0) {
      await tx.delete(serviceExtraCompatibility).where(inArray(serviceExtraCompatibility.extra_id, extraIds));
      await tx.delete(extraVehicleEntries).where(inArray(extraVehicleEntries.extra_id, extraIds));
      await tx.delete(stationExtras).where(inArray(stationExtras.id, extraIds));
    }
    await tx.delete(stationConfigs).where(inArray(stationConfigs.id, stationIds));
    /* stations.user_id has no onDelete (RESTRICT by default) — must nullify before
       deleting users or the user DELETE will be blocked by this FK. */
    await tx.update(stations).set({ user_id: null }).where(inArray(stations.id, stationIds));
    await tx.delete(stations).where(inArray(stations.id, stationIds));
  }

  /* Tickets/messages addressed to or sent by prod-seed users. */
  const prevTickets = await tx
    .select({ id: supportTickets.id })
    .from(supportTickets)
    .where(inArray(supportTickets.created_by, userIds));
  const ticketIds: string[] = prevTickets.map((t: any) => t.id);
  if (ticketIds.length > 0) {
    await tx.delete(supportMessages).where(inArray(supportMessages.ticket_id, ticketIds));
    await tx.delete(supportTickets).where(inArray(supportTickets.id, ticketIds));
  }

  await tx.delete(favorites).where(inArray(favorites.user_id, userIds));
  await tx.delete(userNotifications).where(inArray(userNotifications.user_id, userIds));
  await tx.delete(userNotificationPrefs).where(inArray(userNotificationPrefs.user_id, userIds));
  await tx.delete(notifications).where(inArray(notifications.user_id, userIds));
  await tx.delete(users).where(inArray(users.id, userIds));
  console.log(`Cleanup: removed ${userIds.length} prod-seed users + ${stationIds.length} stations.`);
}


// %%%%% Reference data %%%%%
// Idempotent inserts of admin, commission, wash types

async function ensureAdmin(tx: any): Promise<string> {
  const existing = await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (existing.length > 0) return existing[0].id;
  const [row] = await tx.insert(users).values({
    first_name: "Hurryline",
    last_name: "Admin",
    email: "admin@hurryline.local",
    phone: null,
    password_hash: HASH_ADMIN,
    status: "active",
    role: "admin",
    email_verified_at: new Date(),
  }).returning({ id: users.id });
  return row.id;
}

async function ensureCommission(tx: any, adminId: string): Promise<void> {
  const existing = await tx.select({ id: commissionSettings.id }).from(commissionSettings).limit(1);
  if (existing.length > 0) return;
  await tx.insert(commissionSettings).values({
    rate: COMMISSION_RATE,
    set_by: adminId,
    effective_at: new Date(),
  });
}

async function ensurePlatformSettings(tx: any): Promise<void> {
  const PLATFORM = [
    { key: "cancellation_penalty_percent", value: "20.00" },
    { key: "cancellation_free_window_minutes", value: "60" },
    { key: "cancellation_penalty_platform_rate", value: "0.70" },
    { key: "cancellation_penalty_station_rate", value: "0.30" },
    { key: "max_advance_booking_days", value: "14" },
    { key: "rating_window_days", value: "7" },
    { key: "default_late_tolerance_minutes", value: "5" },
    { key: "max_tip_amount_xaf", value: "500" },
    { key: "reminder_first_window_hours", value: "5" },
    { key: "reminder_second_window_minutes", value: "30" },
  ];
  const existing = await tx.select({ key: settings.key }).from(settings).where(eq(settings.type, "admin"));
  const have = new Set(existing.map((r: any) => r.key));
  for (const p of PLATFORM) {
    if (have.has(p.key)) continue;
    await tx.insert(settings).values({ type: "admin", key: p.key, value: p.value, entity_id: null });
  }
}

async function ensureWashTypes(tx: any): Promise<Map<string, string>> {
  const seed = [
    { code: "hand_wash", label: "Lavage à la main", sort_order: 1, is_active: true },
    { code: "automatic", label: "Lavage automatique", sort_order: 2, is_active: true },
    { code: "self_service", label: "Libre-service", sort_order: 3, is_active: true },
  ];
  await tx.insert(washTypes).values(seed).onConflictDoNothing({ target: washTypes.code });
  const rows = await tx.select({ id: washTypes.id, code: washTypes.code }).from(washTypes);
  return new Map(rows.map((r: any) => [r.code as string, r.id as string]));
}


// %%%%% Users %%%%%
// Station managers + clients

async function createStationManagers(tx: any): Promise<Map<number, string>> {
  const managerById = new Map<number, string>();
  for (let i = 0; i < CITY_PROFILES.length; i++) {
    const c = CITY_PROFILES[i];
    /* Email already routed via SEED_USER_PREFIX through `prod-seed.station.<i>` */
    const email = `${SEED_USER_PREFIX}${c.managerEmail}`;
    const [row] = await tx.insert(users).values({
      first_name: pick(FRENCH_FIRST_NAMES),
      last_name: pick(FRENCH_LAST_NAMES),
      email,
      phone: `+1438555${String(2000 + i).padStart(4, "0")}`,
      password_hash: HASH_STATION,
      status: "active",
      role: "station",
      email_verified_at: monthsAgoMs(8 + (i % 3)),
    }).returning({ id: users.id });
    managerById.set(i, row.id);
  }
  console.log(`Users: ${managerById.size} station managers.`);
  return managerById;
}

async function createClients(tx: any): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < TOTAL_CLIENTS; i++) {
    const first = pick(FRENCH_FIRST_NAMES);
    const last = pick(FRENCH_LAST_NAMES);
    const slug = `${first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${last.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "")}`;
    const email = `${SEED_USER_PREFIX}${slug}.${i}@hurryline.demo`;
    /* Spread sign-ups across the 10-month window so the cohort dashboard looks
     * non-trivial. ~30 % of clients verified email; the rest stay un-verified. */
    const createdAt = monthsAgoMs(rand() * HISTORY_MONTHS);
    const verified = rand() < 0.7 ? new Date(createdAt.getTime() + randInt(60, 60 * 60 * 24) * 1000) : null;
    const [row] = await tx.insert(users).values({
      first_name: first,
      last_name: last,
      email,
      phone: `+1514${String(randInt(2000000, 9999999))}`,
      password_hash: HASH_CLIENT,
      status: "active",
      role: "client",
      email_verified_at: verified,
      created_at: createdAt,
      updated_at: createdAt,
    }).returning({ id: users.id });
    ids.push(row.id);
  }
  console.log(`Users: ${ids.length} clients.`);
  return ids;
}


// %%%%% Stations %%%%%
// Stations + configs + posts + formats + wash types + photos + hours

interface StationContext {
  id: string;
  config: CityProfile;
  postIds: string[];
  formatIds: string[];
  formatPrices: Map<string, number>;
}

async function createStations(
  tx: any,
  managerById: Map<number, string>,
  adminId: string,
  washTypeByCode: Map<string, string>,
): Promise<StationContext[]> {
  const out: StationContext[] = [];

  for (let i = 0; i < CITY_PROFILES.length; i++) {
    const c = CITY_PROFILES[i];
    const managerId = managerById.get(i)!;
    const approvedAt = monthsAgoMs(8 + (i % 3));

    const [station] = await tx.insert(stations).values({
      user_id: managerId,
      name: c.name,
      legal_name: c.name + " Inc.",
      registration_number: `1234567${String(i).padStart(2, "0")}`,
      address: c.address,
      city: c.name.split(" ")[1] ?? "Montréal",
      postal_code: c.postal,
      latitude: String(c.lat),
      longitude: String(c.lng),
      description: c.description,
      service_scope: c.scope,
      wash_post_count: c.postCount,
      status: "active",
      is_open: true,
      stripe_account_id: process.env.SEED_STRIPE_ACCOUNT_ID || null,
      approved_by: adminId,
      approved_at: approvedAt,
      created_at: approvedAt,
    }).returning({ id: stations.id });

    await tx.insert(stationConfigs).values({
      id: station.id,
      opening_time: "08:00:00+00",
      closing_time: "20:00:00+00",
      break_start: null,
      break_end: null,
      wash_duration_minutes: c.duration,
      wash_post_count: c.postCount,
      late_tolerance_minutes: 5,
      cancellation_delay_minutes: 60,
      max_concurrent_posts: c.postCount,
      margin_before_minutes: 5,
      margin_after_minutes: 10,
      reservation_surcharge: c.surcharge,
    });

    const postIds: string[] = [];
    for (let p = 1; p <= c.postCount; p++) {
      const [row] = await tx.insert(stationPosts).values({
        station_id: station.id,
        position: p,
        is_active: true,
      }).returning({ id: stationPosts.id });
      postIds.push(row.id);
    }

    const formatIds: string[] = [];
    const formatPrices = new Map<string, number>();
    /* Each station picks 4 of the 5 formats and shifts price by ±15 % so the
     * data set has heterogeneous totals. */
    const subset = FORMAT_BASE.slice(0, 4 + (i % 2));
    for (const f of subset) {
      const adjusted = Math.round(f.basePrice * (1 + (rand() - 0.5) * 0.3) * 100) / 100;
      const [row] = await tx.insert(vehicleFormats).values({
        label: f.label,
        price: adjusted.toFixed(2),
        is_active: true,
      }).returning({ id: vehicleFormats.id });
      formatIds.push(row.id);
      formatPrices.set(row.id, adjusted);
    }

    for (const code of c.washTypes) {
      const wtId = washTypeByCode.get(code);
      if (wtId) await tx.insert(stationWashTypes).values({ station_id: station.id, wash_type_id: wtId });
    }

    /* Open every day of the week with a 12 h amplitude — matches the booking
     * flow's availability calc which reads station_hours, not just configs. */
    for (let day = 0; day < 7; day++) {
      await tx.insert(stationHours).values({
        station_id: station.id,
        day_of_week: day,
        is_open: true,
        morning_start: "08:00:00",
        morning_end: "12:00:00",
        afternoon_start: "13:00:00",
        afternoon_end: "20:00:00",
      });
    }

    for (let p = 0; p < c.photos.length; p++) {
      await tx.insert(stationPhotos).values({
        station_id: station.id,
        url: c.photos[p],
        position: p,
      });
    }

    /* ── Services (packages) per station ── */
    const serviceTemplates = [
      { name: "Lavage extérieur", category: "hand_wash", service_type: "exterior", desc: "Nettoyage soigné de la carrosserie, jantes et vitres.", popular: true },
      { name: "Lavage intérieur", category: "hand_wash", service_type: "interior", desc: "Aspiration complète, nettoyage tableau de bord et vitres intérieures.", popular: false },
      { name: "Lavage complet",   category: "hand_wash", service_type: "complete",  desc: "Intérieur + extérieur, nettoyage approfondi.", popular: true },
    ];
    if (c.washTypes.includes("automatic")) {
      serviceTemplates.push({ name: "Lavage automatique", category: "automatic", service_type: "exterior", desc: "Tunnel automatique haute pression.", popular: false });
    }
    if (c.washTypes.includes("self_service")) {
      serviceTemplates.push({ name: "Libre-service", category: "self_service", service_type: "exterior", desc: "Poste libre-service avec équipement fourni.", popular: false });
    }

    for (const svc of serviceTemplates) {
      const [sRow] = await tx.insert(stationServices).values({
        station_id: station.id,
        name: svc.name,
        category: svc.category,
        service_type: svc.service_type,
        description: svc.desc,
        is_active: true,
        is_popular: svc.popular,
      }).returning({ id: stationServices.id });

      /* Price entries per vehicle format for hand_wash; single entry for others. */
      if (svc.category === "hand_wash") {
        const baseMultiplier = svc.service_type === "complete" ? 1.8 : svc.service_type === "interior" ? 0.85 : 1;
        for (const fId of formatIds) {
          const fPrice = formatPrices.get(fId) ?? 15;
          await tx.insert(serviceVehicleEntries).values({
            service_id: sRow.id,
            vehicle_format_id: fId,
            vehicle_label: "Standard",
            price: (fPrice * baseMultiplier).toFixed(2),
            duration_min: svc.service_type === "complete" ? 60 : 35,
            staff_required: svc.service_type === "complete" ? 2 : 1,
            is_active: true,
          });
        }
      } else {
        const flatPrice = svc.category === "automatic" ? "8.99" : "5.50";
        await tx.insert(serviceVehicleEntries).values({
          service_id: sRow.id,
          vehicle_format_id: null,
          vehicle_label: svc.category === "automatic" ? "Tous véhicules" : "Libre-service",
          price: flatPrice,
          duration_min: 15,
          staff_required: 0,
          is_active: true,
        });
      }
    }

    /* ── Extras (add-ons) per station ── */
    const extraTemplates = [
      { label: "Cire de protection",      scope: "exterior", price: "6.00",  duration_min: 10 },
      { label: "Shampooing moquettes",    scope: "interior", price: "8.50",  duration_min: 15 },
      { label: "Désinfection habitacle",  scope: "interior", price: "5.00",  duration_min: 10 },
      { label: "Nettoyage des vitres",    scope: "both",     price: "4.00",  duration_min: 8  },
      { label: "Protection jantes",       scope: "exterior", price: "7.00",  duration_min: 10 },
    ];
    /* Each station gets 2–4 extras picked pseudo-randomly. */
    const numExtras = 2 + (i % 3);
    for (let e = 0; e < numExtras; e++) {
      const extra = extraTemplates[e % extraTemplates.length];
      const [eRow] = await tx.insert(stationExtras).values({
        station_id: station.id,
        label: extra.label,
        scope: extra.scope,
        price: extra.price,
        duration_min: extra.duration_min,
        staff_required: 0,
        is_active: true,
      }).returning({ id: stationExtras.id });

      for (const fId of formatIds) {
        await tx.insert(extraVehicleEntries).values({
          extra_id: eRow.id,
          vehicle_format_id: fId,
          price: extra.price,
          is_active: true,
        });
      }
    }

    /* ── KYC Documents for active stations ── */
    const docTypes: Array<"business_license" | "insurance" | "identity_document"> =
      ["business_license", "insurance", "identity_document"];
    const expiryBase = new Date();
    expiryBase.setFullYear(expiryBase.getFullYear() + 1);
    for (const docType of docTypes) {
      const expiry = new Date(expiryBase);
      expiry.setMonth(expiry.getMonth() + (i % 6)); /* stagger expiries */
      await tx.insert(stationDocuments).values({
        station_id: station.id,
        document_type: docType,
        file_url: DOC_URLS[docType],
        storage: "cloudinary",
        terms_accepted: true,
        expiry_date: expiry,
        created_at: approvedAt,
      });
    }

    /* ── serviceExtraCompatibility: link hand_wash services to all extras ── */
    const svcRows = await tx
      .select({ id: stationServices.id, category: stationServices.category })
      .from(stationServices)
      .where(eq(stationServices.station_id, station.id));
    const extraRows = await tx
      .select({ id: stationExtras.id })
      .from(stationExtras)
      .where(eq(stationExtras.station_id, station.id));
    for (const svc of svcRows) {
      if (svc.category !== "hand_wash") continue;
      for (const ex of extraRows) {
        await tx.insert(serviceExtraCompatibility).values({
          service_id: svc.id,
          extra_id: ex.id,
        });
      }
    }

    /* ── Station hour exceptions (1-2 holidays per station) ── */
    const today = new Date();
    const holidayDates = [
      new Date(today.getFullYear(), 0, 1),   /* Jan 1 */
      new Date(today.getFullYear(), 11, 25), /* Dec 25 */
    ];
    for (const hd of holidayDates) {
      if (i % 2 === 0 && hd > approvedAt) {
        const dateStr = hd.toISOString().slice(0, 10);
        await tx.insert(stationHourExceptions).values({
          station_id: station.id,
          exception_date: dateStr,
          reason: hd.getMonth() === 0 ? "Jour de l'An" : "Jour de Noël",
          created_at: approvedAt,
        }).onConflictDoNothing();
      }
    }

    out.push({ id: station.id, config: c, postIds, formatIds, formatPrices });
  }
  console.log(`Stations: ${out.length} active stations.`);
  return out;
}


// %%%%% Reservations & queue %%%%%
// 10 months of historical bookings + future window

async function createBookings(
  tx: any,
  ctxs: StationContext[],
  clientIds: string[],
): Promise<{
  totalCompleted: number;
  completedSamples: Array<{ id: string; userId: string; stationId: string; tipAmount: string | null }>;
}> {
  /* Status distribution for past entries (entry_type = reservation):
   *   completed 80 %, cancelled 8 %, no_show 6 %, late→queue 6 % */
  const PAST_STATUS = [
    { value: "completed", weight: 80 },
    { value: "cancelled", weight: 8 },
    { value: "no_show", weight: 6 },
    { value: "in_progress", weight: 0 }, /* never historically */
    { value: "moved_to_queue", weight: 6 },
  ];
  /* Slot for each booking: spread across opening hours (8h-20h) with a peak
   * on Saturday and lunchtime + early evening on weekdays. */
  const HOUR_WEIGHTS = [
    [8, 1], [9, 2], [10, 3], [11, 4], [12, 4],
    [13, 3], [14, 3], [15, 4], [16, 5], [17, 5], [18, 4], [19, 2],
  ] as const;

  let totalCompleted = 0;
  const completedSamples: Array<{ id: string; userId: string; stationId: string; tipAmount: string | null }> = [];

  /* ─── Past reservations (entry_type=reservation) ─── */
  for (let i = 0; i < TOTAL_RESERVATIONS; i++) {
    const ctx = ctxs[i % ctxs.length];
    const userId = pick(clientIds);
    const formatId = pick(ctx.formatIds);
    const price = ctx.formatPrices.get(formatId) ?? 16;
    const surcharge = ctx.config.surcharge ? parseFloat(ctx.config.surcharge) : 0;
    const total = price + surcharge;

    const status = pickWeighted(PAST_STATUS);
    const startTime = randomPastSlot(HOUR_WEIGHTS, ctx.config.duration);
    const endTime = new Date(startTime.getTime() + ctx.config.duration * 60_000);

    const [slot] = await tx.insert(timeSlots).values({
      station_id: ctx.id,
      start_time: startTime,
      end_time: endTime,
      capacity: 1,
      booked_count: status === "cancelled" ? 0 : 1,
      status: status === "cancelled" ? "available" : "full",
    }).returning({ id: timeSlots.id });

    const commission = Math.round(total * 0.1 * 100) / 100;
    const payout = Math.round((total - commission) * 100) / 100;
    const completedAt = status === "completed" ? new Date(endTime.getTime() + randInt(0, 5) * 60_000) : null;
    const tipAmount = status === "completed" && rand() < 0.18 ? (randInt(1, 5)).toFixed(2) : null;

    const finalStatus = status === "moved_to_queue" ? "cancelled" : status === "no_show" ? "cancelled" : status;
    const cancellationReason = status === "no_show" ? "no_show" : status === "moved_to_queue" ? "moved_to_queue" : status === "cancelled" ? "client_request" : null;
    /* Late cancellation: ~40 % of cancelled reservations were within the free window
     * and incurred a penalty (20 % of total). */
    const hasLatePenalty = (status === "cancelled") && rand() < 0.4;
    const penaltyAmount = hasLatePenalty ? (total * 0.2).toFixed(2) : null;

    const [res] = await tx.insert(reservations).values({
      user_id: userId,
      station_id: ctx.id,
      vehicle_format_id: formatId,
      post_id: pick(ctx.postIds),
      entry_type: "reservation",
      booking_source: rand() < 0.12 ? "qr" : "standard",
      time_slot_id: slot.id,
      status: finalStatus,
      ticket_code: randomTicketCode(),
      amount_paid: total.toFixed(2),
      commission_rate: COMMISSION_RATE,
      commission_amount: commission.toFixed(2),
      station_payout: payout.toFixed(2),
      tip_amount: tipAmount,
      penalty_amount: penaltyAmount,
      cancellation_reason: cancellationReason,
      confirmed_at: new Date(startTime.getTime() - randInt(60, 60 * 24 * 5) * 60_000),
      completed_at: completedAt,
      created_at: new Date(startTime.getTime() - randInt(60 * 30, 60 * 60 * 24 * 7) * 1000),
      updated_at: completedAt ?? endTime,
    }).returning({ id: reservations.id });

    if (status === "no_show") {
      const feeAmt = (price * 0.2).toFixed(2);
      await tx.insert(noShowFees).values({
        reservation_id: res.id,
        user_id: userId,
        station_id: ctx.id,
        amount: feeAmt,
        reason: "Client absent au créneau réservé.",
        status: rand() < 0.7 ? "charged" : "waived",
        created_at: endTime,
      });
    }

    if (status === "completed") {
      totalCompleted++;
      if (completedSamples.length < 2200) {
        completedSamples.push({ id: res.id, userId, stationId: ctx.id, tipAmount: tipAmount });
      }
      if (tipAmount) {
        await tx.insert(reservationTips).values({
          reservation_id: res.id,
          client_id: userId,
          station_id: ctx.id,
          amount: tipAmount,
          stripe_payment_intent_id: `pi_seed_${res.id.replace(/-/g, "").slice(0, 20)}`,
          stripe_transfer_id: `tr_seed_${res.id.replace(/-/g, "").slice(0, 20)}`,
          status: "completed",
          created_at: completedAt ?? endTime,
        });
      }
    }
  }

  /* ─── Past queue entries (entry_type=queue) ─── */
  for (let i = 0; i < TOTAL_QUEUE; i++) {
    const ctx = ctxs[i % ctxs.length];
    const userId = pick(clientIds);
    const formatId = pick(ctx.formatIds);
    const price = ctx.formatPrices.get(formatId) ?? 14;
    const status = pickWeighted([
      { value: "completed", weight: 70 },
      { value: "cancelled", weight: 25 },
      { value: "no_show", weight: 5 },
    ]);
    const joinedAt = randomPastTimestamp();
    const completedAt = status === "completed" ? new Date(joinedAt.getTime() + randInt(15, 90) * 60_000) : null;
    const commission = Math.round(price * 0.1 * 100) / 100;
    const payout = Math.round((price - commission) * 100) / 100;
    const queueTip = status === "completed" && rand() < 0.15 ? (randInt(1, 4)).toFixed(2) : null;

    const [res] = await tx.insert(reservations).values({
      user_id: userId,
      station_id: ctx.id,
      vehicle_format_id: formatId,
      post_id: null,
      entry_type: "queue",
      booking_source: "standard",
      time_slot_id: null,
      status: status === "no_show" ? "cancelled" : status,
      queue_position: randInt(1, 8),
      ticket_code: randomTicketCode(),
      amount_paid: price.toFixed(2),
      commission_rate: COMMISSION_RATE,
      commission_amount: commission.toFixed(2),
      station_payout: payout.toFixed(2),
      tip_amount: queueTip,
      cancellation_reason: status === "no_show" ? "no_show" : status === "cancelled" ? "client_request" : null,
      completed_at: completedAt,
      created_at: joinedAt,
      updated_at: completedAt ?? joinedAt,
    }).returning({ id: reservations.id });

    if (status === "completed") {
      totalCompleted++;
      if (completedSamples.length < 2400) {
        completedSamples.push({ id: res.id, userId, stationId: ctx.id, tipAmount: queueTip });
      }
      if (queueTip) {
        await tx.insert(reservationTips).values({
          reservation_id: res.id,
          client_id: userId,
          station_id: ctx.id,
          amount: queueTip,
          stripe_payment_intent_id: `pi_seed_q${res.id.replace(/-/g, "").slice(0, 19)}`,
          stripe_transfer_id: `tr_seed_q${res.id.replace(/-/g, "").slice(0, 19)}`,
          status: "completed",
          created_at: completedAt ?? joinedAt,
        });
      }
    }
  }

  /* ─── Future bookings ─── */
  for (let i = 0; i < FUTURE_RESERVATIONS; i++) {
    const ctx = ctxs[i % ctxs.length];
    const userId = pick(clientIds);
    const formatId = pick(ctx.formatIds);
    const price = ctx.formatPrices.get(formatId) ?? 16;
    const surcharge = ctx.config.surcharge ? parseFloat(ctx.config.surcharge) : 0;
    const total = price + surcharge;

    const startTime = randomFutureSlot(ctx.config.duration);
    const endTime = new Date(startTime.getTime() + ctx.config.duration * 60_000);
    const [slot] = await tx.insert(timeSlots).values({
      station_id: ctx.id,
      start_time: startTime,
      end_time: endTime,
      capacity: 1,
      booked_count: 1,
      status: "full",
    }).returning({ id: timeSlots.id });

    const commission = Math.round(total * 0.1 * 100) / 100;
    const payout = Math.round((total - commission) * 100) / 100;

    await tx.insert(reservations).values({
      user_id: userId,
      station_id: ctx.id,
      vehicle_format_id: formatId,
      post_id: pick(ctx.postIds),
      entry_type: "reservation",
      booking_source: rand() < 0.12 ? "qr" : "standard",
      time_slot_id: slot.id,
      status: "confirmed",
      ticket_code: randomTicketCode(),
      amount_paid: total.toFixed(2),
      commission_rate: COMMISSION_RATE,
      commission_amount: commission.toFixed(2),
      station_payout: payout.toFixed(2),
      confirmed_at: new Date(),
      created_at: new Date(Date.now() - randInt(60, 60 * 24 * 3) * 60_000),
    });
  }

  /* ─── Future queue entries ─── */
  for (let i = 0; i < FUTURE_QUEUE; i++) {
    const ctx = ctxs[i % ctxs.length];
    const userId = pick(clientIds);
    const formatId = pick(ctx.formatIds);
    const price = ctx.formatPrices.get(formatId) ?? 14;
    const commission = Math.round(price * 0.1 * 100) / 100;
    const payout = Math.round((price - commission) * 100) / 100;
    await tx.insert(reservations).values({
      user_id: userId,
      station_id: ctx.id,
      vehicle_format_id: formatId,
      post_id: null,
      entry_type: "queue",
      booking_source: "standard",
      time_slot_id: null,
      status: "confirmed",
      queue_position: i + 1,
      ticket_code: randomTicketCode(),
      amount_paid: price.toFixed(2),
      commission_rate: COMMISSION_RATE,
      commission_amount: commission.toFixed(2),
      station_payout: payout.toFixed(2),
      created_at: new Date(Date.now() - randInt(5, 60 * 4) * 60_000),
    });
  }

  console.log(
    `Reservations: ${TOTAL_RESERVATIONS} past reservations + ${TOTAL_QUEUE} past queue + ` +
    `${FUTURE_RESERVATIONS} future + ${FUTURE_QUEUE} future queue. ` +
    `${totalCompleted} completed.`,
  );
  return { totalCompleted, completedSamples };
}


// %%%%% Ratings %%%%%
// One rating on ~70 % of completed reservations, skewed positive

async function createRatings(
  tx: any,
  completed: Array<{ id: string; userId: string; stationId: string; tipAmount: string | null }>,
): Promise<void> {
  const SCORES = [
    { value: 5, weight: 55 },
    { value: 4, weight: 27 },
    { value: 3, weight: 12 },
    { value: 2, weight: 4 },
    { value: 1, weight: 2 },
  ];
  let n = 0;
  for (const r of completed) {
    if (rand() > 0.7) continue;
    const score = pickWeighted(SCORES);
    await tx.insert(ratings).values({
      reservation_id: r.id,
      user_id: r.userId,
      station_id: r.stationId,
      score,
      comment: pick(RATING_COMMENTS),
      is_visible: rand() < 0.97,
    });
    n++;
  }
  console.log(`Ratings: ${n} created.`);
}


// %%%%% Favorites %%%%%
// ~30 % of clients favorite 1–5 stations they've visited

async function createFavorites(
  tx: any,
  ctxs: StationContext[],
  clientIds: string[],
): Promise<void> {
  const stationIds = ctxs.map((c) => c.id);
  const seen = new Set<string>();
  let n = 0;
  for (const userId of clientIds) {
    if (rand() > 0.30) continue;
    const count = randInt(1, Math.min(5, stationIds.length));
    const shuffled = [...stationIds].sort(() => rand() - 0.5).slice(0, count);
    for (const stationId of shuffled) {
      const key = `${userId}:${stationId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await tx.insert(favorites).values({ user_id: userId, station_id: stationId });
      n++;
    }
  }
  console.log(`Favorites: ${n} created.`);
}


// %%%%% Scenario stations %%%%%
// Non-active stations: pending KYC, rejected, inactive — covers admin validation flow

async function createScenarioStations(
  tx: any,
  adminId: string,
): Promise<void> {
  for (let i = 0; i < SCENARIO_PROFILES.length; i++) {
    const p = SCENARIO_PROFILES[i];
    const email = `${SEED_USER_PREFIX}${p.managerEmail}`;
    const [mgr] = await tx.insert(users).values({
      first_name: pick(FRENCH_FIRST_NAMES),
      last_name: pick(FRENCH_LAST_NAMES),
      email,
      phone: `+1438666${String(3000 + i).padStart(4, "0")}`,
      password_hash: HASH_STATION,
      status: "active",
      role: "station",
      email_verified_at: new Date(),
    }).returning({ id: users.id });

    const createdAt = monthsAgoMs(rand() * 3 + 1);
    const [station] = await tx.insert(stations).values({
      user_id: mgr.id,
      name: p.name,
      legal_name: p.name + " Inc.",
      registration_number: `9900000${String(i).padStart(2, "0")}`,
      address: p.address,
      city: p.name.split(" ")[1] ?? "Québec",
      postal_code: p.postal,
      latitude: String(p.lat),
      longitude: String(p.lng),
      description: p.description,
      service_scope: "both",
      wash_post_count: 2,
      status: p.status,
      is_open: false,
      stripe_account_id: null,
      approved_by: p.status === "rejected" ? adminId : null,
      approved_at: null,
      rejection_reason: p.rejectionReason ?? null,
      rejection_count: p.status === "rejected" ? 1 : 0,
      created_at: createdAt,
    }).returning({ id: stations.id });

    /* Docs: partial for pending KYC, one bad doc for rejected, full for inactive. */
    for (const docType of p.docs) {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 2);
      await tx.insert(stationDocuments).values({
        station_id: station.id,
        document_type: docType,
        file_url: DOC_URLS[docType],
        storage: "cloudinary",
        terms_accepted: p.status !== "pending_admin_validation",
        expiry_date: expiry,
        created_at: createdAt,
      });
    }

    /* Inactive station has full hours config so it could re-open at any time. */
    if (p.status === "inactive") {
      await tx.insert(stationConfigs).values({
        id: station.id,
        opening_time: "08:00:00+00",
        closing_time: "20:00:00+00",
        break_start: null,
        break_end: null,
        wash_duration_minutes: 20,
        wash_post_count: 2,
        late_tolerance_minutes: 5,
        cancellation_delay_minutes: 60,
        max_concurrent_posts: 2,
        margin_before_minutes: 5,
        margin_after_minutes: 10,
        reservation_surcharge: "2.00",
      });
      for (let day = 0; day < 7; day++) {
        await tx.insert(stationHours).values({
          station_id: station.id,
          day_of_week: day,
          is_open: day !== 0,
          morning_start: day !== 0 ? "08:00:00" : null,
          morning_end: day !== 0 ? "12:00:00" : null,
          afternoon_start: day !== 0 ? "13:00:00" : null,
          afternoon_end: day !== 0 ? "20:00:00" : null,
        });
      }
    }
  }
  console.log(`Scenario stations: ${SCENARIO_PROFILES.length} (pending/rejected/inactive).`);
}


// %%%%% Disputes %%%%%
// ~15 disputes on completed reservations (open / refunded / resolved / rejected mix)

async function createDisputes(
  tx: any,
  completed: Array<{ id: string; userId: string; stationId: string; tipAmount: string | null }>,
  adminId: string,
): Promise<void> {
  const DISPUTE_REASONS = [
    "Lavage incomplet, plusieurs zones non nettoyées.",
    "Rayure constatée après le lavage.",
    "Montant débité ne correspond pas au tarif affiché.",
    "Service non rendu, station fermée à mon arrivée.",
    "Intérieur mouillé et non séché correctement.",
  ];
  const sampled = [...completed].sort(() => rand() - 0.5).slice(0, 15);
  let n = 0;
  for (const s of sampled) {
    const status = pickWeighted([
      { value: "open",     weight: 30 },
      { value: "refunded", weight: 25 },
      { value: "resolved", weight: 25 },
      { value: "rejected", weight: 20 },
    ]);
    const createdAt = monthsAgoMs(rand() * HISTORY_MONTHS);
    await tx.insert(disputes).values({
      reservation_id: s.id,
      client_id: s.userId,
      station_id: s.stationId,
      reason: pick(DISPUTE_REASONS),
      description: rand() < 0.6 ? "Je souhaite un remboursement partiel pour la prestation non conforme." : null,
      status,
      requested_amount: (randInt(5, 30)).toFixed(2),
      refunded_amount: status === "refunded" ? (randInt(5, 25)).toFixed(2) : "0.00",
      closed_by: status !== "open" ? adminId : null,
      closed_reason: status === "rejected" ? "La demande ne remplit pas les critères de remboursement." :
                     status === "resolved" ? "Résolu à l'amiable avec la station." : null,
      created_at: createdAt,
      updated_at: createdAt,
    });
    n++;
  }
  console.log(`Disputes: ${n} created.`);
}


// %%%%% User notifications %%%%%
// In-app notification feed entries for clients

async function createUserNotifications(
  tx: any,
  clientIds: string[],
  ctxs: StationContext[],
): Promise<void> {
  const NOTIF_KINDS = [
    {
      kind: "reservation_confirmed",
      title: "Réservation confirmée",
      body: (stationName: string) => `Votre réservation chez ${stationName} a été confirmée.`,
      url: "/reservations",
    },
    {
      kind: "reservation_completed",
      title: "Lavage terminé",
      body: (stationName: string) => `Votre véhicule a été lavé chez ${stationName}. N'oubliez pas de laisser un avis !`,
      url: "/reservations",
    },
    {
      kind: "queue_new",
      title: "Votre tour approche",
      body: (stationName: string) => `Vous êtes le prochain dans la file chez ${stationName}.`,
      url: "/reservations",
    },
    {
      kind: "delay_request",
      title: "Demande de retard",
      body: (_: string) => "Votre demande de retard a été acceptée par la station.",
      url: "/reservations",
    },
    {
      kind: "system",
      title: "Bienvenue sur Hurryline",
      body: (_: string) => "Découvrez les stations proches de vous et réservez en quelques secondes.",
      url: "/stations",
    },
  ];

  let n = 0;
  for (const userId of clientIds) {
    const count = randInt(2, 7);
    for (let k = 0; k < count; k++) {
      const tpl = pick(NOTIF_KINDS);
      const ctx = pick(ctxs);
      const createdAt = monthsAgoMs(rand() * HISTORY_MONTHS);
      const isRead = rand() < 0.65;
      await tx.insert(userNotifications).values({
        user_id: userId,
        kind: tpl.kind,
        title: tpl.title,
        body: tpl.body(ctx.config.name),
        action_url: tpl.url,
        payload: { station_id: ctx.id },
        read_at: isRead ? new Date(createdAt.getTime() + randInt(60, 3600) * 1000) : null,
        created_at: createdAt,
      });
      n++;
    }
  }
  console.log(`UserNotifications: ${n} in-app entries.`);
}


// %%%%% Notification prefs %%%%%
// Default notification preference rows for all users

async function createNotificationPrefs(
  tx: any,
  allUserIds: string[],
): Promise<void> {
  const DEFAULT_PREFS = {
    reservation_confirmed: true,
    reservation_completed: true,
    queue_update: true,
    delay_accepted: true,
    marketing: false,
  };
  for (const userId of allUserIds) {
    await tx.insert(userNotificationPrefs).values({
      user_id: userId,
      prefs: DEFAULT_PREFS,
    }).onConflictDoNothing();
  }
  console.log(`NotificationPrefs: ${allUserIds.length} rows.`);
}


// %%%%% Admin logs %%%%%
// Audit trail: station approvals, dispute closures, setting changes

async function createAdminLogs(
  tx: any,
  adminId: string,
  ctxs: StationContext[],
): Promise<void> {
  let n = 0;
  for (const ctx of ctxs) {
    await tx.insert(adminLogs).values({
      admin_id: adminId,
      action: "station_approved",
      target_type: "station",
      target_id: ctx.id,
      details: { name: ctx.config.name, city: ctx.config.name.split(" ")[1] ?? "Montréal" },
      created_at: monthsAgoMs(8 + (n % 3)),
    });
    n++;
  }
  /* A few setting update audit rows. */
  for (let i = 0; i < 5; i++) {
    await tx.insert(adminLogs).values({
      admin_id: adminId,
      action: "setting_updated",
      target_type: "settings",
      target_id: null,
      details: { key: "commission_rate", old: "0.0800", new: COMMISSION_RATE },
      created_at: monthsAgoMs(HISTORY_MONTHS - i),
    });
  }
  console.log(`AdminLogs: ${n + 5} entries.`);
}


async function refreshStationAggregates(tx: any, stationIds: string[]): Promise<void> {
  for (const sid of stationIds) {
    const [row] = await tx
      .select({
        avg: sql<number>`coalesce(round(avg(${ratings.score})::numeric, 2), 0)`,
        cnt: sql<number>`count(*)::int`,
      })
      .from(ratings)
      .where(eq(ratings.station_id, sid));
    if (row && Number(row.cnt) > 0) {
      await tx.update(stations).set({
        average_score: String(Number(row.avg)),
        total_ratings: Number(row.cnt),
      }).where(eq(stations.id, sid));
    }
  }
}


// %%%%% Misc activity %%%%%
// Delay requests, reschedule audits, support tickets

async function createMiscActivity(
  tx: any,
  ctxs: StationContext[],
  completed: Array<{ id: string; userId: string; stationId: string; tipAmount: string | null }>,
  clientIds: string[],
): Promise<void> {
  /* Delay requests: pick 25 random completed reservations, half accepted, the
   * rest split between refused / pending. */
  const sampled = [...completed].sort(() => rand() - 0.5).slice(0, 25);
  for (const s of sampled) {
    const ctx = ctxs.find((c) => c.id === s.stationId);
    if (!ctx) continue;
    const status = pickWeighted([
      { value: "accepted", weight: 60 },
      { value: "refused", weight: 25 },
      { value: "pending", weight: 15 },
    ]);
    await tx.insert(delayRequests).values({
      reservation_id: s.id,
      user_id: s.userId,
      station_id: s.stationId,
      status,
      message: rand() < 0.5 ? "Je serai en retard d'environ 10 minutes, désolé." : null,
      refusal_reason: status === "refused" ? "Le créneau ne peut pas être prolongé." : null,
      created_at: monthsAgoMs(rand() * HISTORY_MONTHS),
    });
  }
  console.log(`Activity: ${sampled.length} delay requests.`);

  /* Reschedule audits: 40 sampled past completed reservations record an old
   * → new pair. We just point to the same id twice for simplicity since the
   * audit table only needs valid FKs. */
  const reschedSample = [...completed].sort(() => rand() - 0.5).slice(0, 40);
  for (const s of reschedSample) {
    await tx.insert(rescheduleRequests).values({
      original_reservation_id: s.id,
      new_reservation_id: s.id,
      user_id: s.userId,
      station_id: s.stationId,
      had_penalty: rand() < 0.3,
      penalty_amount: rand() < 0.3 ? "5.00" : null,
      refunded_amount: "0.00",
    });
  }
  console.log(`Activity: ${reschedSample.length} reschedule audit rows.`);

  /* Support tickets: sprinkle 60 tickets across clients with 1-3 messages each. */
  for (let i = 0; i < 60; i++) {
    const userId = pick(clientIds);
    const tpl = pick(SUPPORT_SUBJECTS);
    const status = pickWeighted([
      { value: "ferme", weight: 50 },
      { value: "resolu", weight: 25 },
      { value: "en_cours", weight: 15 },
      { value: "ouvert", weight: 10 },
    ]);
    const createdAt = monthsAgoMs(rand() * HISTORY_MONTHS);
    const ticketNumber = `T-${String(Date.now()).slice(-6)}-${String(i).padStart(3, "0")}`;
    const [ticket] = await tx.insert(supportTickets).values({
      ticket_number: ticketNumber,
      created_by: userId,
      subject: tpl.subject,
      status,
      priority: pickWeighted([
        { value: "normal", weight: 70 },
        { value: "bas", weight: 20 },
        { value: "urgent", weight: 10 },
      ]),
      category: pickWeighted([
        { value: "facturation", weight: 35 },
        { value: "technique", weight: 30 },
        { value: "bug", weight: 20 },
        { value: "autre", weight: 15 },
      ]),
      resolved_at: status === "resolu" || status === "ferme" ? new Date(createdAt.getTime() + randInt(1, 72) * 60 * 60 * 1000) : null,
      created_at: createdAt,
      updated_at: createdAt,
    }).returning({ id: supportTickets.id });
    await tx.insert(supportMessages).values({
      ticket_id: ticket.id,
      sender_id: userId,
      is_from_admin: false,
      content: tpl.body,
      created_at: createdAt,
    });
    if (status !== "ouvert" && rand() < 0.7) {
      await tx.insert(supportMessages).values({
        ticket_id: ticket.id,
        sender_id: userId,
        is_from_admin: true,
        content: "Bonjour, nous avons examiné votre demande et apporté les correctifs nécessaires.",
        created_at: new Date(createdAt.getTime() + randInt(1, 12) * 60 * 60 * 1000),
      });
    }
  }
  console.log("Activity: 60 support tickets.");
}


// %%%%% Date helpers %%%%%
// Build past and future timestamps with realistic distribution

function monthsAgoMs(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - Math.floor(months));
  d.setDate(d.getDate() - Math.floor((months - Math.floor(months)) * 30));
  d.setHours(randInt(8, 20), randInt(0, 59), 0, 0);
  return d;
}

function randomPastTimestamp(): Date {
  return monthsAgoMs(rand() * HISTORY_MONTHS);
}

function randomPastSlot(
  hourWeights: ReadonlyArray<readonly [number, number]>,
  durationMin: number,
): Date {
  const hour = pickWeighted(hourWeights.map(([h, w]) => ({ value: h, weight: w })));
  const monthsBack = rand() * HISTORY_MONTHS;
  const d = new Date();
  d.setMonth(d.getMonth() - Math.floor(monthsBack));
  d.setDate(d.getDate() - Math.floor((monthsBack - Math.floor(monthsBack)) * 30));
  /* Snap to a multiple of `durationMin` so slots align with the booking grid. */
  const minute = Math.floor((rand() * 60) / durationMin) * durationMin;
  d.setHours(hour, minute, 0, 0);
  return isoMinute(d);
}

function randomFutureSlot(durationMin: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + randInt(1, FUTURE_DAYS));
  d.setHours(randInt(9, 18), Math.floor((rand() * 60) / durationMin) * durationMin, 0, 0);
  return isoMinute(d);
}


// %%%%% Entry point %%%%%

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  console.log(
    `Production seed: ${TOTAL_CLIENTS} clients, ${CITY_PROFILES.length} active + ${SCENARIO_PROFILES.length} scenario stations, ` +
    `${TOTAL_RESERVATIONS + TOTAL_QUEUE} historical entries over ${HISTORY_MONTHS} months.`,
  );

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  const start = Date.now();

  try {
    await db.transaction(async (tx) => {
      await ensurePlatformSettings(tx);
      const adminId = await ensureAdmin(tx);
      await ensureCommission(tx, adminId);
      const washTypeByCode = await ensureWashTypes(tx);

      await cleanupPreviousSeed(tx);

      const managerById = await createStationManagers(tx);
      const clientIds = await createClients(tx);
      const ctxs = await createStations(tx, managerById, adminId, washTypeByCode);

      const { completedSamples } = await createBookings(tx, ctxs, clientIds);
      await createRatings(tx, completedSamples);
      await createFavorites(tx, ctxs, clientIds);
      await refreshStationAggregates(tx, ctxs.map((c) => c.id));
      await createMiscActivity(tx, ctxs, completedSamples, clientIds);

      /* Extended scenarios */
      await createScenarioStations(tx, adminId);
      await createDisputes(tx, completedSamples, adminId);
      await createUserNotifications(tx, clientIds, ctxs);
      const allUserIds = [
        ...clientIds,
        ...Array.from({ length: CITY_PROFILES.length }, (_, i) => managerById.get(i)!),
      ];
      await createNotificationPrefs(tx, allUserIds);
      await createAdminLogs(tx, adminId, ctxs);
    });

    const seconds = Math.round((Date.now() - start) / 1000);
    console.log(`Production seed completed in ${seconds}s.`);
  } finally {
    await pool.end();
  }
}

const isMain = typeof require !== "undefined" && require.main === module;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
