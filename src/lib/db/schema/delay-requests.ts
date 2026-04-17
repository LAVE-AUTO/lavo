/**
 * Delay requests: client signals they will be late for a confirmed reservation.
 * Station can accept or refuse. Does not alter reservation status — the cron remains
 * the sole arbiter of actual late detection and queue downgrade.
 */
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { reservations } from './reservations';
import { stations } from './stations';
import { users } from './users';

export const delayRequests = pgTable(
  'delay_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reservation_id: uuid('reservation_id')
      .notNull()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    station_id: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    /** pending | accepted | refused */
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    message: text('message'),
    refusal_reason: text('refusal_reason'),
    created_at: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('delay_requests_reservation_id_idx').on(table.reservation_id),
    index('delay_requests_station_id_idx').on(table.station_id),
    index('delay_requests_user_id_idx').on(table.user_id),
    index('delay_requests_status_idx').on(table.status),
  ]
);
