/**
 * Per-post (wash bay) availability hours, by day of week (0=Sunday … 6=Saturday).
 * One row per (station_post_id, day_of_week).
 *
 * Absence of a row means the post inherits the station's hours (station_hours)
 * for that day. When a row is present, the post's window is a SUBSET of the
 * station's window for that day: it can only NARROW availability, never extend
 * it beyond station_hours (a post can't open on a day the station is closed,
 * outside the station's window, or during its break). This subset rule is
 * enforced in the service layer against station_hours.
 *
 * Mirrors the morning/afternoon shape of station_hours so a post can honour the
 * same lunch break split.
 */
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { stationPosts } from "./stations";

export const stationPostHours = pgTable(
  "station_post_hours",
  {
    station_post_id: uuid("station_post_id")
      .notNull()
      .references(() => stationPosts.id, { onDelete: "cascade" }),
    day_of_week: integer("day_of_week").notNull(), // 0=Sunday … 6=Saturday
    is_open: boolean("is_open").notNull().default(true),
    morning_start: time("morning_start"),
    morning_end: time("morning_end"),
    afternoon_start: time("afternoon_start"),
    afternoon_end: time("afternoon_end"),
    updated_at: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.station_post_id, table.day_of_week] }),
  ]
);
