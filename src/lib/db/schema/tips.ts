/**
 * Tip (pourboire) paid by a client after a completed reservation.
 * One tip per reservation — enforced by unique constraint on reservation_id.
 * The Stripe transfer to the station is handled via destination charge (transfer_data.destination)
 * with no application_fee_amount, so 100% of the tip flows to the station.
 */
import { decimal, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
// Note: no currency column — currency is a Stripe concern, not stored on our side.
import { reservations } from "./reservations";
import { stations } from "./stations";
import { users } from "./users";

export const reservationTips = pgTable(
  "reservation_tips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservation_id: uuid("reservation_id")
      .notNull()
      .unique()
      .references(() => reservations.id, { onDelete: "cascade" }),
    client_id: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    /** Tip amount in the platform currency. */
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    /** Stripe PaymentIntent ID for this tip. Unique to prevent duplicate charges. */
    stripe_payment_intent_id: varchar("stripe_payment_intent_id", { length: 200 })
      .notNull()
      .unique(),
    /**
     * Stripe Transfer ID — populated after the destination charge is confirmed
     * and the automatic transfer to the station's connected account completes.
     * Set via the payment_intent.succeeded Stripe webhook.
     */
    stripe_transfer_id: varchar("stripe_transfer_id", { length: 200 }),
    /** pending → completed | failed */
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    created_at: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("reservation_tips_client_id_idx").on(table.client_id),
    index("reservation_tips_station_id_idx").on(table.station_id),
    index("reservation_tips_status_idx").on(table.status),
  ]
);
