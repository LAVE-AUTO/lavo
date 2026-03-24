/**
 * Reschedule request: audit trail for reservation slot changes.
 * Records the original reservation, the new reservation, and financial details
 * (penalty applied if rescheduled within the late-cancellation window).
 */
import { boolean, decimal, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { reservations } from './reservations';
import { stations } from './stations';
import { users } from './users';

export const rescheduleRequests = pgTable(
  'reschedule_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    original_reservation_id: uuid('original_reservation_id')
      .notNull()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    new_reservation_id: uuid('new_reservation_id')
      .notNull()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    station_id: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    had_penalty: boolean('had_penalty').notNull().default(false),
    penalty_amount: decimal('penalty_amount', { precision: 10, scale: 2 }),
    refunded_amount: decimal('refunded_amount', { precision: 10, scale: 2 }),
    created_at: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('reschedule_requests_original_reservation_id_idx').on(table.original_reservation_id),
    index('reschedule_requests_new_reservation_id_idx').on(table.new_reservation_id),
    index('reschedule_requests_user_id_idx').on(table.user_id),
    index('reschedule_requests_station_id_idx').on(table.station_id),
  ]
);
