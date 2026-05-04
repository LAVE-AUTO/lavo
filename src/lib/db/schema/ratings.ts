/**
 * Post-service ratings (one per completed reservation).
 * Score 1-5, optional comment; station average is denormalized on stations.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { reservations } from "./reservations";
import { stations } from "./stations";
import { users } from "./users";

/** Post-service rating per reservation; score 1-5, optional comment. */
export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservation_id: uuid("reservation_id")
      .notNull()
      .references(() => reservations.id, { onDelete: "cascade" })
      .unique(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    score: smallint("score").notNull(),
    comment: text("comment"),
    is_visible: boolean("is_visible").notNull().default(true),
    created_at: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "ratings_score_range",
      sql`${table.score} >= 1 AND ${table.score} <= 5`,
    ),
    index("ratings_station_id_is_visible_idx").on(
      table.station_id,
      table.is_visible,
    ),
    index("ratings_created_at_idx").on(table.created_at),
  ],
);
