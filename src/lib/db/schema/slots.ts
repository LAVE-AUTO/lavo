/**
 * Time slots (creneaux) created manually by stations.
 * Multi-capacity slots: capacity = wash_post_count at creation; booked_count tracks reservations.
 */
import {
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stations, stationPosts } from "./stations";

/** Time slots (creneaux) per station; capacity and booked_count for queue. */
export const timeSlots = pgTable(
  "time_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    /** Optional wash bay this slot belongs to (per-post availability). Null = legacy/all-bays slot. */
    post_id: uuid("post_id").references(() => stationPosts.id, { onDelete: "set null" }),
    start_time: timestamp("start_time", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    end_time: timestamp("end_time", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    capacity: integer("capacity").notNull(),
    booked_count: integer("booked_count").notNull().default(0),
    status: varchar("status", { length: 30 }).notNull(),
    created_at: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("time_slots_station_start_idx").on(table.station_id, table.start_time),
    index("time_slots_status_idx").on(table.status),
  ]
);
