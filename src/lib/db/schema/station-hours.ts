/**
 * Per-station opening hours by day of week (0=Sunday … 6=Saturday).
 * One row per (station_id, day_of_week); upserted by PATCH /station/hours.
 * station_hour_exceptions records closed dates (holidays, one-off closures).
 */
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stations } from "./stations";

export const stationHours = pgTable(
  "station_hours",
  {
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
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
    primaryKey({ columns: [table.station_id, table.day_of_week] }),
  ]
);

export const stationHourExceptions = pgTable(
  "station_hour_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    station_id: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    exception_date: date("exception_date", { mode: "string" }).notNull(),
    reason: varchar("reason", { length: 200 }).notNull(),
    // Whether the station is OPEN that day. false = fully closed (holiday /
    // one-off closure). true = open, either all day (open_time/close_time NULL)
    // or with special hours (open_time -> close_time set).
    is_open: boolean("is_open").notNull().default(false),
    open_time: time("open_time"),
    close_time: time("close_time"),
    created_at: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("station_hour_exceptions_station_date_unique").on(
      table.station_id,
      table.exception_date
    ),
    index("station_hour_exceptions_station_id_idx").on(table.station_id),
  ]
);
